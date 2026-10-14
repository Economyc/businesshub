// Logica pura de la marcacion por reconocimiento facial (sin Firestore), para
// poder probarla aislada. El navegador calcula el descriptor de la cara con
// face-api (vector de 128 numeros) y aqui se compara contra los perfiles
// registrados del local.
/** Distancia euclidiana maxima para aceptar que dos caras son la misma persona.
 *  0.6 es el umbral clasico de face-api; 0.5 es mas estricto para no confundir
 *  gente parecida. */
export const MATCH_MAX_DISTANCE = 0.5;
/** El segundo candidato tiene que quedar al menos esta distancia mas lejos. Si
 *  dos empleados quedan casi empatados, no se marca a ninguno. */
export const MATCH_MIN_MARGIN = 0.06;
/** Segundo nivel: entre MATCH_MAX_DISTANCE y esto se acepta solo si dos fotos
 *  de la rafaga coinciden y hay mucha ventaja sobre el segundo. Rescata a quien
 *  tiene una sola referencia floja (foto de otra camara) o mala luz ese dia. */
export const MATCH_SOFT_MAX_DISTANCE = 0.55;
export const MATCH_SOFT_MIN_MARGIN = 0.12;
/** Por debajo de esta distancia (y con ventaja clara) la marcacion es tan
 *  segura que la foto se guarda como referencia extra del empleado (aprende
 *  luz, barba, gorra...). Con 0.4 los perfiles registrados con una foto de otra
 *  camara (siempre 0.41-0.49) nunca aprendian y terminaban sin reconocerse. */
export const LEARN_MAX_DISTANCE = 0.45;
export const LEARN_MIN_MARGIN = 0.1;
/** Referencias guardadas por empleado: la selfie de registro + las aprendidas. */
export const MAX_DESCRIPTORS = 10;
/** Fotos de la rafaga que manda el kiosco por marcacion. */
export const MAX_PROBES = 3;
/** Dos marcaciones del mismo empleado dentro de esta ventana se toman como una. */
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
/** Tope absoluto: una entrada abierta de hace mas de esto nunca se cierra con
 *  la marcacion nueva (se asume que olvido marcar la salida). */
export const OPEN_SHIFT_MAX_MS = 18 * 60 * 60 * 1000;
/** Un turno de Horarios que termina tarde (despues del corte del dia) alarga la
 *  vigencia de la entrada hasta su fin mas esto. */
export const SHIFT_END_GRACE_MS = 4 * 60 * 60 * 1000;
/** Hora (Colombia) del dia siguiente a la entrada en la que se corta el dia
 *  laboral: hasta ahi una entrada abierta se cierra con la proxima marcacion. */
export const DAY_ROLLOVER_HOUR = 6;
/** Una marcacion de otro dia a menos de esto del inicio de un turno de hoy es
 *  la entrada a ese turno (aunque haya una entrada abierta de ayer). */
export const NEW_SHIFT_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Salida sin entrada: solo desde esto antes del fin del turno... */
export const MISSED_IN_BEFORE_END_MS = 45 * 60 * 1000;
/** ...hasta esto despues... */
export const MISSED_IN_AFTER_END_MS = 2 * 60 * 60 * 1000;
/** ...y nunca si algun turno del empleado empieza a menos de esto: a esa hora
 *  lo normal es que este llegando (cambio de turno, horario que se movio). */
export const MISSED_IN_ARRIVAL_GUARD_MS = 90 * 60 * 1000;
/** Para asociar una entrada a su turno: el inicio no puede quedar mas lejos. */
const OWN_SHIFT_MAX_GAP_MS = 6 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Bogota es UTC-5 todo el ano (sin horario de verano). */
const BOGOTA_OFFSET_MS = 5 * HOUR_MS;
export const DESCRIPTOR_LENGTH = 128;
export function euclidean(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const d = a[i] - b[i];
        sum += d * d;
    }
    return Math.sqrt(sum);
}
export function isValidDescriptor(v) {
    return (Array.isArray(v) &&
        v.length === DESCRIPTOR_LENGTH &&
        v.every((n) => typeof n === 'number' && Number.isFinite(n)));
}
/** Mejor coincidencia de cada empleado (su referencia mas cercana contra
 *  cualquiera de las fotos de la rafaga) y decision final. Devuelve null si
 *  nadie pasa el umbral o si hay empate. */
export function findMatch(probes, candidates) {
    if (probes.length === 0)
        return null;
    const ranked = candidates
        .filter((c) => c.descriptors.length > 0)
        .map((c) => {
        const perProbe = probes.map((p) => Math.min(...c.descriptors.map((d) => euclidean(p, d))));
        const bestIdx = perProbe.indexOf(Math.min(...perProbe));
        return { employeeId: c.employeeId, employeeName: c.employeeName, perProbe, distance: perProbe[bestIdx], probe: probes[bestIdx] };
    })
        .sort((a, b) => a.distance - b.distance);
    const best = ranked[0];
    if (!best)
        return null;
    const secondDistance = ranked[1]?.distance ?? Infinity;
    const margin = secondDistance - best.distance;
    const result = {
        employeeId: best.employeeId,
        employeeName: best.employeeName,
        distance: best.distance,
        secondDistance,
        probe: best.probe,
    };
    if (best.distance <= MATCH_MAX_DISTANCE)
        return margin >= MATCH_MIN_MARGIN ? result : null;
    // Segundo nivel: todas las fotos (al menos dos) cerca del mismo empleado.
    const agree = best.perProbe.length >= 2 && best.perProbe.every((d) => d <= MATCH_SOFT_MAX_DISTANCE);
    return agree && margin >= MATCH_SOFT_MIN_MARGIN ? result : null;
}
/** Si la marcacion es tan clara que la foto se guarda como referencia. */
export function shouldLearn(match) {
    return match.distance <= LEARN_MAX_DISTANCE && match.secondDistance - match.distance >= LEARN_MIN_MARGIN;
}
/**
 * Entrada o salida segun la ultima marcacion del empleado y sus turnos de
 * Horarios (los de los ultimos dias, solo de ese empleado).
 *
 * Horarios no siempre refleja lo que pasa (cambios de turno, dobles, llegadas
 * tarde), asi que pesa mas la historia del propio empleado:
 * - Una entrada abierta del mismo dia laboral (hasta las DAY_ROLLOVER_HOUR del
 *   dia siguiente, tope OPEN_SHIFT_MAX_MS) siempre se cierra. Horarios solo
 *   puede alargar ese corte, nunca acortarlo: quien se queda doble sale bien.
 * - Si la entrada abierta es de otro dia y hoy hay un turno que empieza cerca,
 *   la marcacion es la entrada a ese turno.
 *
 * Sin entrada vigente, la marcacion es entrada salvo que caiga justo al final
 * de un turno al que no marco entrada (`missedIn`): salida sin entrada.
 */
export function decidePunch(last, nowMs, shifts = []) {
    if (last?.type === 'in' && openEntryStillValid(last.atMs, nowMs, shifts))
        return { type: 'out', missedIn: false };
    return missedShiftEntry(last, nowMs, shifts) ? { type: 'out', missedIn: true } : { type: 'in', missedIn: false };
}
export function nextPunchType(last, nowMs, shifts = []) {
    return decidePunch(last, nowMs, shifts).type;
}
function openEntryStillValid(inMs, nowMs, shifts) {
    if (nowMs - inMs > OPEN_SHIFT_MAX_MS)
        return false;
    const inDate = bogotaDate(inMs);
    const today = bogotaDate(nowMs);
    if (inDate !== today) {
        const startsNow = shifts.some((s) => s.date === today && Math.abs(shiftStartMs(s) - nowMs) <= NEW_SHIFT_WINDOW_MS);
        if (startsNow)
            return false;
    }
    let deadline = dayStartMs(inDate) + DAY_MS + DAY_ROLLOVER_HOUR * HOUR_MS;
    const own = ownShift(shifts, inMs);
    if (own)
        deadline = Math.max(deadline, shiftEndMs(own) + SHIFT_END_GRACE_MS);
    return nowMs <= deadline;
}
/** Marca al final de un turno (de MISSED_IN_BEFORE_END_MS antes del fin a
 *  MISSED_IN_AFTER_END_MS despues, ya pasada la mitad), ningun turno suyo
 *  empieza cerca y no tiene ninguna marcacion desde poco antes de que empezara:
 *  olvido marcar la entrada y esta saliendo. */
function missedShiftEntry(last, nowMs, shifts) {
    if (shifts.some((s) => Math.abs(shiftStartMs(s) - nowMs) <= MISSED_IN_ARRIVAL_GUARD_MS))
        return false;
    let ending = null;
    let bestGap = Infinity;
    for (const shift of shifts) {
        const end = shiftEndMs(shift);
        if (nowMs < end - MISSED_IN_BEFORE_END_MS || nowMs > end + MISSED_IN_AFTER_END_MS)
            continue;
        if (nowMs < (shiftStartMs(shift) + end) / 2)
            continue;
        const gap = Math.abs(end - nowMs);
        if (gap < bestGap) {
            ending = shift;
            bestGap = gap;
        }
    }
    if (!ending)
        return false;
    return !last || last.atMs < shiftStartMs(ending) - NEW_SHIFT_WINDOW_MS;
}
/** Turno al que corresponde una entrada: el de inicio mas cercano, si esta a
 *  menos de OWN_SHIFT_MAX_GAP_MS. */
function ownShift(shifts, atMs) {
    let best = null;
    let bestGap = Infinity;
    for (const s of shifts) {
        const gap = Math.abs(shiftStartMs(s) - atMs);
        if (gap < bestGap) {
            best = s;
            bestGap = gap;
        }
    }
    return best && bestGap <= OWN_SHIFT_MAX_GAP_MS ? best : null;
}
/** 'YYYY-MM-DD' en hora de Colombia. */
export function bogotaDate(ms) {
    return new Date(ms - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}
function dayStartMs(date) {
    return Date.parse(`${date}T00:00:00Z`) + BOGOTA_OFFSET_MS;
}
function minutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
function shiftStartMs(s) {
    return dayStartMs(s.date) + minutes(s.start) * 60_000;
}
function shiftEndMs(s) {
    const start = minutes(s.start);
    let end = minutes(s.end);
    if (end <= start)
        end += 24 * 60; // cruza la medianoche
    return dayStartMs(s.date) + end * 60_000;
}
export function isDuplicate(last, nowMs) {
    return !!last && nowMs - last.atMs < DUPLICATE_WINDOW_MS;
}
/** Agrega un descriptor aprendido. Las referencias de registro (`keep`
 *  primeras) nunca se descartan. Lleno, sale la aprendida mas parecida a la
 *  nueva: asi quedan referencias variadas (luz de dia y de noche, gorra, barba)
 *  y no diez casi iguales del mismo turno. */
export function learnDescriptor(descriptors, probe, keep = 1) {
    if (descriptors.length < MAX_DESCRIPTORS)
        return [...descriptors, probe];
    const enrolled = descriptors.slice(0, Math.min(keep, MAX_DESCRIPTORS - 1));
    const learned = descriptors.slice(enrolled.length, MAX_DESCRIPTORS);
    let closest = 0;
    for (let i = 1; i < learned.length; i++) {
        if (euclidean(learned[i], probe) < euclidean(learned[closest], probe))
            closest = i;
    }
    return [...enrolled, ...learned.filter((_, i) => i !== closest), probe];
}
//# sourceMappingURL=match.js.map