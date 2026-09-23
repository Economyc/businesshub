import { randomBytes } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firestore.js';
import { CALLABLE_CORS_ORIGINS } from '../cors-origins.js';
import { findMatch, isDuplicate, isValidDescriptor, learnDescriptor, nextPunchType, LEARN_MAX_DISTANCE, } from './match.js';
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
//   Storage attendance/{cid}/{date}/{id}.jpg     foto de la marcacion (se borra a los 45 dias por lifecycle del bucket)
const KIOSKS = 'attendanceKiosks';
const PROFILES = 'faceProfiles';
const PUNCHES = 'attendancePunches';
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
    return { companyName: c.name ?? '', logo: c.logo ?? null, logoThumb: c.logoThumb ?? null, color: c.color ?? null };
});
// ── Link publico: registrar una marcacion ────────────────────────────────────
export const attendancePunch = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 30, cors: CALLABLE_CORS_ORIGINS }, async (request) => {
    const data = (request.data ?? {});
    const companyId = await companyFromToken(data.token);
    if (!isValidDescriptor(data.descriptor))
        throw new HttpsError('invalid-argument', 'Descriptor de cara inválido');
    const probe = data.descriptor;
    const photo = typeof data.photoBase64 === 'string' ? Buffer.from(data.photoBase64, 'base64') : null;
    if (!photo || photo.length === 0 || photo.length > MAX_PHOTO_BYTES) {
        throw new HttpsError('invalid-argument', 'Foto inválida');
    }
    const profilesRef = db.collection('companies').doc(companyId).collection(PROFILES);
    const profiles = await profilesRef.get();
    const candidates = profiles.docs.map((d) => {
        const p = d.data();
        return { employeeId: d.id, employeeName: p.employeeName, descriptors: (p.descriptors ?? []).map((x) => x.v) };
    });
    const match = findMatch(probe, candidates);
    if (!match)
        return { matched: false };
    const now = new Date();
    const nowMs = now.getTime();
    const date = localDate(now);
    const profileRef = profilesRef.doc(match.employeeId);
    const punchRef = db.collection('companies').doc(companyId).collection(PUNCHES).doc();
    const photoPath = `attendance/${companyId}/${date}/${punchRef.id}.jpg`;
    const photoFile = getStorage().bucket(BUCKET).file(photoPath);
    // La foto va antes que la marcacion: una marcacion nunca queda sin su
    // evidencia. Si al final no se registra (duplicado), se borra.
    await photoFile.save(photo, { contentType: 'image/jpeg', resumable: false });
    // Transaccion: dos taps seguidos en la tablet no pueden dejar dos entradas.
    const outcome = await db.runTransaction(async (tx) => {
        const snap = await tx.get(profileRef);
        if (!snap.exists)
            return null;
        const p = snap.data();
        const last = p.lastPunchType && p.lastPunchAt
            ? { type: p.lastPunchType, atMs: p.lastPunchAt.toMillis() }
            : null;
        if (isDuplicate(last, nowMs)) {
            return { duplicate: true, type: last.type, atMs: last.atMs };
        }
        const type = nextPunchType(last, nowMs);
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
    };
});
//# sourceMappingURL=index.js.map