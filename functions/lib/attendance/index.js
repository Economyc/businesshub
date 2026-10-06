import { randomBytes } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../firestore.js';
import { CALLABLE_CORS_ORIGINS } from '../cors-origins.js';
import { findMatch, isDuplicate, isValidDescriptor, learnDescriptor, decidePunch, LEARN_MAX_DISTANCE, } from './match.js';
// Marcacion de entrada/salida con reconocimiento facial.
//
// Cada local tiene un link publico (`/marcar/{token}` en App2) que se deja
// abierto en una tablet o PC fijo. El link no tiene sesion: el token es lo unico
// que identifica el local, por eso vive en una coleccion raiz que solo toca el
// Admin SDK (`attendanceKiosks/{token}`, sin reglas que la abran al cliente).
//
// El navegador calcula el descriptor de la cara; la comparacion contra los
// perfiles se hace aqui para que los perfiles nunca salgan al link publico.
//
// Datos:
//   attendanceKiosks/{token}                     { companyId, createdAt, createdBy }
//   companies/{cid}/faceProfiles/{employeeId}    { employeeName, descriptors: [{v}], lastPunchType, lastPunchAt }
//   companies/{cid}/attendancePunches/{id}       { employeeId, employeeName, type, at, date, distance, photoPath, source }
//   companies/{cid}/shifts/{id}                  turnos de Horarios (solo lectura: deciden entrada vs salida)
//   Storage attendance/{cid}/{date}/{id}.jpg     foto de la marcacion (se borra a los 45 dias por lifecycle del bucket)
const KIOSKS = 'attendanceKiosks';
const PROFILES = 'faceProfiles';
const PUNCHES = 'attendancePunches';
const SHIFTS = 'shifts';
/** El empleado puede corregir entrada/salida desde el kiosco hasta esto despues
 *  de marcar (boton "No, es mi entrada" del resultado). */
const FLIP_WINDOW_MS = 2 * 60 * 1000;
const TZ = 'America/Bogota';
const MAX_PHOTO_BYTES = 400 * 1024;
// Explicito: desplegado con gcloud (no firebase-tools) el runtime no trae
// FIREBASE_CONFIG y `bucket()` sin nombre falla.
const BUCKET = 'empresas-bf.firebasestorage.app';
async function assertCompanyMember(uid, companyId) {
    const snap = await db.collection('companies').doc(companyId).collection('members').doc(uid).get();
    if (!snap.exists || snap.data().status !== 'active') {
        throw new HttpsError('permission-denied', 'No eres miembro activo de esta empresa');
    }
}
async function companyFromToken(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{32}$/.test(token)) {
        throw new HttpsError('not-found', 'Link de marcación inválido');
    }
    const snap = await db.collection(KIOSKS).doc(token).get();
    if (!snap.exists)
        throw new HttpsError('not-found', 'Link de marcación inválido o reemplazado');
    return snap.data().companyId;
}
/** 'YYYY-MM-DD' en hora de Colombia. */
function localDate(d) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
// ── Admin: obtener o regenerar el link del local ───────────────────────────
export const attendanceKioskLink = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: CALLABLE_CORS_ORIGINS }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'Login requerido');
    const { companyId, rotate } = (request.data ?? {});
    if (!companyId)
        throw new HttpsError('invalid-argument', 'companyId requerido');
    await assertCompanyMember(request.auth.uid, companyId);
    const existing = await db.collection(KIOSKS).where('companyId', '==', companyId).get();
    if (!rotate && !existing.empty)
        return { token: existing.docs[0].id };
    // Regenerar invalida el link anterior (por si se filtro fuera del local).
    const token = randomBytes(16).toString('hex');
    const batch = db.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));
    batch.set(db.collection(KIOSKS).doc(token), {
        companyId,
        createdAt: Timestamp.now(),
        createdBy: request.auth.uid,
    });
    await batch.commit();
    return { token };
});
// ── Link publico: datos del local para pintar la pantalla ───────────────────
export const attendanceKioskInfo = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: CALLABLE_CORS_ORIGINS }, async (request) => {
    const companyId = await companyFromToken((request.data ?? {}).token);
    const snap = await db.collection('companies').doc(companyId).get();
    const c = (snap.data() ?? {});
    return {
        companyName: c.name ?? '',
        location: c.location ?? null,
        logo: c.logo ?? null,
        logoThumb: c.logoThumb ?? null,
        color: c.color ?? null,
    };
});
// ── Link publico: registrar una marcacion ────────────────────────────────────
export const attendancePunch = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 30, cors: CALLABLE_CORS_ORIGINS }, async (request) => {
    const data = (request.data ?? {});
    // Ping del kiosco para mantener la instancia caliente: no toca nada.
    if (data.warm === true)
        return { matched: false };
    const companyId = await companyFromToken(data.token);
    if (!isValidDescriptor(data.descriptor))
        throw new HttpsError('invalid-argument', 'Descriptor de cara inválido');
    const probe = data.descriptor;
    const photo = typeof data.photoBase64 === 'string' ? Buffer.from(data.photoBase64, 'base64') : null;
    if (!photo || photo.length === 0 || photo.length > MAX_PHOTO_BYTES) {
        throw new HttpsError('invalid-argument', 'Foto inválida');
    }
    const profilesRef = db.collection('companies').doc(companyId).collection(PROFILES);
    const now = new Date();
    const nowMs = now.getTime();
    const date = localDate(now);
    const punchRef = db.collection('companies').doc(companyId).collection(PUNCHES).doc();
    const photoPath = `attendance/${companyId}/${date}/${punchRef.id}.jpg`;
    const photoFile = getStorage().bucket(BUCKET).file(photoPath);
    // La foto sube en paralelo con la lectura de perfiles (es lo mas lento). Va
    // antes que la marcacion: una marcacion nunca queda sin su evidencia. Si al
    // final no se registra (sin match o duplicado), se borra.
    const photoSaved = photoFile.save(photo, { contentType: 'image/jpeg', resumable: false });
    // Marca la promesa como manejada: si falla mientras se leen los perfiles, el
    // error sale en el `await photoSaved` de abajo y no como rechazo suelto.
    photoSaved.catch(() => undefined);
    const discardPhoto = () => photoSaved.then(() => photoFile.delete()).catch(() => undefined);
    const profiles = await profilesRef.get().catch(async (err) => {
        await discardPhoto();
        throw err;
    });
    const candidates = profiles.docs.map((d) => {
        const p = d.data();
        return { employeeId: d.id, employeeName: p.employeeName, descriptors: (p.descriptors ?? []).map((x) => x.v) };
    });
    const match = findMatch(probe, candidates);
    if (!match) {
        await discardPhoto();
        return { matched: false };
    }
    const profileRef = profilesRef.doc(match.employeeId);
    await photoSaved;
    // Ultimas marcaciones: ayer y hoy alcanzan (una entrada abierta caduca a las
    // 18 h). Se lee la coleccion y no el `lastPunch*` del perfil porque un admin
    // puede agregar, corregir o anular marcaciones a mano desde el panel.
    const recentQuery = db.collection('companies').doc(companyId).collection(PUNCHES)
        .where('date', 'in', [localDate(new Date(nowMs - 24 * 60 * 60 * 1000)), date]);
    // Turnos de Horarios de antier a hoy: deciden si una entrada abierta todavia
    // se puede cerrar (ver nextPunchType). Fuera de la transaccion: no cambian
    // por la marcacion y no hace falta bloquearlos.
    const dayMs = 24 * 60 * 60 * 1000;
    const shiftDates = [localDate(new Date(nowMs - 2 * dayMs)), localDate(new Date(nowMs - dayMs)), date];
    const shiftsSnap = await db.collection('companies').doc(companyId).collection(SHIFTS)
        .where('date', 'in', shiftDates).get();
    const shifts = shiftsSnap.docs
        .map((d) => d.data())
        .filter((s) => s.employeeId === match.employeeId && s.start && s.end);
    // Transaccion: dos taps seguidos en la tablet no pueden dejar dos entradas.
    const outcome = await db.runTransaction(async (tx) => {
        const snap = await tx.get(profileRef);
        if (!snap.exists)
            return null;
        const p = snap.data();
        const recent = await tx.get(recentQuery);
        const last = recent.docs
            .map((d) => d.data())
            .filter((x) => x.employeeId === match.employeeId && !x.voided && x.at.toMillis() <= nowMs)
            .map((x) => ({ type: x.type, atMs: x.at.toMillis() }))
            .sort((a, b) => b.atMs - a.atMs)[0] ?? null;
        if (isDuplicate(last, nowMs)) {
            return { duplicate: true, type: last.type, atMs: last.atMs };
        }
        const { type, missedIn } = decidePunch(last, nowMs, shifts);
        const at = Timestamp.fromDate(now);
        tx.set(punchRef, {
            employeeId: match.employeeId,
            employeeName: p.employeeName,
            type,
            at,
            date,
            distance: Math.round(match.distance * 1000) / 1000,
            photoPath,
            source: 'face',
            // Salida sin entrada (olvido marcar al llegar): el panel no la empareja
            // con una entrada vieja que haya quedado abierta.
            ...(missedIn ? { missedIn: true } : {}),
            createdAt: at,
            updatedAt: at,
        });
        const update = { lastPunchType: type, lastPunchAt: at };
        if (match.distance <= LEARN_MAX_DISTANCE) {
            const current = (p.descriptors ?? []).map((x) => x.v);
            update.descriptors = learnDescriptor(current, probe).map((v) => ({ v }));
        }
        tx.update(profileRef, update);
        return { duplicate: false, type, atMs: nowMs };
    });
    if (!outcome || outcome.duplicate)
        await photoFile.delete().catch(() => undefined);
    if (!outcome)
        return { matched: false };
    return {
        matched: true,
        duplicate: outcome.duplicate,
        employeeName: match.employeeName,
        type: outcome.type,
        at: new Date(outcome.atMs).toISOString(),
        // Solo en marcaciones nuevas: habilita la correccion desde el kiosco.
        punchId: outcome.duplicate ? null : punchRef.id,
    };
});
// ── Link publico: corregir entrada <-> salida recien marcada ────────────────
// El kiosco adivina si es entrada o salida; si se equivoca (p. ej. olvido la
// salida de ayer), el empleado lo corrige en la misma pantalla. Solo la
// marcacion facial recien hecha, para que el link publico no edite historia.
export const attendanceFlipPunch = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: CALLABLE_CORS_ORIGINS }, async (request) => {
    const { token, punchId } = (request.data ?? {});
    const companyId = await companyFromToken(token);
    if (typeof punchId !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(punchId)) {
        throw new HttpsError('invalid-argument', 'Marcación inválida');
    }
    const company = db.collection('companies').doc(companyId);
    const punchRef = company.collection(PUNCHES).doc(punchId);
    const type = await db.runTransaction(async (tx) => {
        const snap = await tx.get(punchRef);
        if (!snap.exists)
            throw new HttpsError('not-found', 'Marcación no encontrada');
        const p = snap.data();
        const age = Date.now() - (p.createdAt?.toMillis() ?? 0);
        if (p.source !== 'face' || p.voided || age > FLIP_WINDOW_MS) {
            throw new HttpsError('failed-precondition', 'Ya no se puede corregir esta marcación');
        }
        const profileRef = company.collection(PROFILES).doc(p.employeeId);
        const profile = await tx.get(profileRef);
        const next = p.type === 'in' ? 'out' : 'in';
        const now = Timestamp.now();
        // `missedIn` solo aplica a salidas; al volverla entrada se quita.
        tx.update(punchRef, { type: next, flippedFrom: p.type, flippedAt: now, updatedAt: now, missedIn: FieldValue.delete() });
        if (profile.exists)
            tx.update(profileRef, { lastPunchType: next });
        return next;
    });
    return { type };
});
//# sourceMappingURL=index.js.map