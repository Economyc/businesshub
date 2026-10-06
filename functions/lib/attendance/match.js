// Logica pura de la marcacion por reconocimiento facial (sin Firestore), para
// poder probarla aislada. El navegador calcula el descriptor de la cara con
// face-api (vector de 128 numeros) y aqui se compara contra los perfiles
// registrados del local.
/** Distancia euclidiana maxima para aceptar que dos caras son la misma persona.
 *  0.6 es el umbral clasico de face-api; 0.5 es mas estricto y es el que se usa
 *  con una sola selfie de registro para no confundir gente parecida. */
export const MATCH_MAX_DISTANCE = 0.5;
/** El segundo candidato tiene que quedar al menos esta distancia mas lejos. Si
 *  dos empleados quedan casi empatados, no se marca a ninguno. */
export const MATCH_MIN_MARGIN = 0.06;
/** Por debajo de esta distancia la marcacion es tan clara que el descriptor se
 *  guarda como referencia extra del empleado (aprende luz, barba, gorra...). */
export const LEARN_MAX_DISTANCE = 0.4;
/** Referencias guardadas por empleado: la selfie de registro + las aprendidas. */
export const MAX_DESCRIPTORS = 6;
/** Dos marcaciones del mismo empleado dentro de esta ventana se toman como una. */
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
/** Tope absoluto: una entrada abierta de hace mas de esto nunca se cierra con
 *  la marcacion nueva (se asume que olvido marcar la salida). */
export const OPEN_SHIFT_MAX_MS = 18 * 60 * 60 * 1000;
/** Con turno en Horarios, la salida se acepta hasta esto despues del fin del
 *  turno. Pasado eso la entrada queda "sin salida" y la marcacion nueva es
 *  entrada. */
export const SHIFT_END_GRACE_MS = 4 * 60 * 60 * 1000;
/** Sin turno en Horarios: hora (Colombia) del dia siguiente a la entrada en la
 *  que se corta el dia. Un turno que cruza la medianoche cierra hasta esta hora. */
export const DAY_ROLLOVER_HOUR = 6;
/** Ventana alrededor de los bordes de un turno: una marcacion de otro dia a
 *  menos de esto del inicio de un turno de hoy es la entrada a ese turno (aunque
 *  haya una entrada abierta de ayer), y a menos de esto del fin puede ser una
 *  salida sin entrada. */
export const NEW_SHIFT_WINDOW_MS = 2 * 60 * 60 * 1000;
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
/** Mejor coincidencia de cada empleado (su referencia mas cercana) y decision
 *  final. Devuelve null si nadie pasa el umbral o si hay empate. */
export function findMatch(probe, candidates) {
    const ranked = candidates
        .filter((c) => c.descriptors.length > 0)
        .map((c) => ({
        employeeId: c.employeeId,
        employeeName: c.employeeName,
        distance: Math.min(...c.descriptors.map((d) => euclidean(probe, d))),
    }))
        .sort((a, b) => a.distance - b.distance);
    const best = ranked[0];
    if (!best || best.distance > MATCH_MAX_DISTANCE)
        return null;
    const second = ranked[1];
    if (second && second.distance - best.distance < MATCH_MIN_MARGIN)
        return null;
    return best;
}
/**
 * Entrada o salida segun la ultima marcacion del empleado y sus turnos de
 * Horarios (los de los ultimos dias, solo de ese empleado).
 *
 * Una entrada abierta solo se cierra mientras siga vigente:
 * - con turno: hasta el fin del turno + SHIFT_END_GRACE_MS;
 * - sin turno: hasta las DAY_ROLLOVER_HOUR del dia siguiente a la entrada;
 * - nunca despues de OPEN_SHIFT_MAX_MS.
 * Si la entrada abierta es de otro dia y hoy hay un turno que empieza cerca,
 * la marcacion es la entrada a ese turno.
 *
 * Sin entrada vigente, la marcacion es entrada salvo que caiga en la ventana de
 * salida de un turno al que no marco entrada (`missedIn`): ahi es una salida
 * sin entrada, como hacen los relojes con ventanas de entrada/salida por turno.
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
    const own = ownShift(shifts, inMs);
    const deadline = own
        ? shiftEndMs(own) + SHIFT_END_GRACE_MS
        : dayStartMs(inDate) + DAY_MS + DAY_ROLLOVER_HOUR * HOUR_MS;
    return nowMs <= deadline;
}
/** Marca cerca del fin de un turno (el borde de turno mas cercano es un fin, ya
 *  paso la mitad del turno) y no tiene ninguna marcacion desde poco antes de
 *  que empezara: olvido marcar la entrada y esta saliendo. */
function missedShiftEntry(last, nowMs, shifts) {
    let nearest = null;
    for (const shift of shifts) {
        for (const isEnd of [false, true]) {
            const gap = Math.abs((isEnd ? shiftEndMs(shift) : shiftStartMs(shift)) - nowMs);
            if (!nearest || gap < nearest.gap)
                nearest = { shift, isEnd, gap };
        }
    }
    if (!nearest || !nearest.isEnd || nearest.gap > NEW_SHIFT_WINDOW_MS)
        return false;
    const startMs = shiftStartMs(nearest.shift);
    if (nowMs < (startMs + shiftEndMs(nearest.shift)) / 2)
        return false;
    return !last || last.atMs < startMs - NEW_SHIFT_WINDOW_MS;
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
/** Agrega un descriptor aprendido. La posicion 0 (selfie de registro) nunca se
 *  descarta; entre las aprendidas sale la mas vieja. */
export function learnDescriptor(descriptors, probe) {
    if (descriptors.length === 0)
        return [probe];
    const [enrolled, ...learned] = descriptors;
    const next = [...learned, probe].slice(-(MAX_DESCRIPTORS - 1));
    return [enrolled, ...next];
}
//# sourceMappingURL=match.js.map