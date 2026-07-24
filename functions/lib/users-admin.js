import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firestore.js';
// Callables que mutan Firebase Auth (createUser, deleteUser, revokeRefreshTokens)
// además de la subcolección companies/{id}/members. La UI ya borraba/leía Firestore
// directamente, pero Auth requiere admin SDK — por eso pasamos por callables.
// Mismo OWNER_EMAIL que usan las apps (core/config/access-registry.ts) y las
// reglas de Firestore. Es la válvula que deja entrar al propietario incluso en
// compañías donde todavía no tiene doc de miembro.
const OWNER_EMAIL = 'admin@filipoblue.co';
function isOwnerEmail(email) {
    return email.trim().toLowerCase() === OWNER_EMAIL;
}
function membersRef(companyId) {
    return db.collection('companies').doc(companyId).collection('members');
}
/**
 * Autoriza al llamante para gestionar usuarios de `companyId`.
 *
 * Desde jul-2026 las reglas de Firestore bloquean la escritura de
 * `companies/{id}/members/**` desde el cliente, así que estos callables son el
 * único camino para altas, bajas y cambios de rol/estado — y por eso reverifican
 * acá, con Admin SDK, en vez de confiar en la UI.
 */
async function assertCanManageUsers(caller) {
    if (isOwnerEmail(caller.email))
        return null;
    const memberSnap = await membersRef(caller.companyId).doc(caller.uid).get();
    if (!memberSnap.exists) {
        throw new HttpsError('permission-denied', 'No eres miembro de esta empresa');
    }
    const member = memberSnap.data();
    // Un miembro suspendido conservaba el permiso mientras su doc existiera.
    if (member.status !== 'active') {
        throw new HttpsError('permission-denied', 'Tu acceso a esta empresa está suspendido');
    }
    // owner/admin tienen acceso por convención (mismo bypass que el hook usePermissions).
    if (member.role === 'owner' || member.role === 'admin')
        return member;
    const roleSnap = await db
        .collection('companies')
        .doc(caller.companyId)
        .collection('roles')
        .doc(member.role)
        .get();
    const role = roleSnap.exists ? roleSnap.data() : null;
    if (!role?.canManageUsers) {
        throw new HttpsError('permission-denied', 'No tienes permiso para gestionar usuarios');
    }
    return member;
}
function requireAuth(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login requerido');
    }
    const data = (request.data ?? {});
    if (!data.companyId || typeof data.companyId !== 'string') {
        throw new HttpsError('invalid-argument', 'companyId requerido');
    }
    return {
        uid: request.auth.uid,
        email: request.auth.token?.email ?? '',
        companyId: data.companyId,
    };
}
export const adminCreateUser = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 }, async (request) => {
    const ctx = requireAuth(request);
    await assertCanManageUsers(ctx);
    const data = request.data;
    if (!data.email || !data.password || !data.displayName || !data.role) {
        throw new HttpsError('invalid-argument', 'email, password, displayName y role son requeridos');
    }
    if (data.password.length < 8) {
        throw new HttpsError('invalid-argument', 'password debe tener al menos 8 caracteres');
    }
    const auth = getAuth();
    let uid;
    try {
        const userRecord = await auth.createUser({
            email: data.email.trim().toLowerCase(),
            password: data.password,
            displayName: data.displayName.trim(),
        });
        uid = userRecord.uid;
    }
    catch (err) {
        const code = err.code;
        if (code === 'auth/email-already-exists') {
            throw new HttpsError('already-exists', 'Ya existe un usuario con ese email');
        }
        if (code === 'auth/invalid-email') {
            throw new HttpsError('invalid-argument', 'Email inválido');
        }
        throw new HttpsError('internal', `Error creando usuario en Auth: ${err.message}`);
    }
    try {
        await db
            .collection('companies')
            .doc(ctx.companyId)
            .collection('members')
            .doc(uid)
            .set({
            userId: uid,
            email: data.email.trim().toLowerCase(),
            displayName: data.displayName.trim(),
            role: data.role,
            status: 'active',
            invitedBy: ctx.uid,
            invitedAt: FieldValue.serverTimestamp(),
            joinedAt: FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        // Rollback: si Firestore falló, borramos el Auth user para no dejar huérfano.
        await auth.deleteUser(uid).catch(() => undefined);
        throw new HttpsError('internal', `Error guardando miembro: ${err.message}`);
    }
    return { uid };
});
export const adminSetUserStatus = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 }, async (request) => {
    const ctx = requireAuth(request);
    await assertCanManageUsers(ctx);
    const data = request.data;
    if (!data.userId || (data.status !== 'active' && data.status !== 'suspended')) {
        throw new HttpsError('invalid-argument', 'userId y status (active|suspended) requeridos');
    }
    if (data.userId === ctx.uid) {
        throw new HttpsError('failed-precondition', 'No puedes cambiar tu propio estado');
    }
    const targetSnap = await db
        .collection('companies')
        .doc(ctx.companyId)
        .collection('members')
        .doc(data.userId)
        .get();
    if (!targetSnap.exists) {
        throw new HttpsError('not-found', 'Miembro no encontrado');
    }
    const target = targetSnap.data();
    if (target.role === 'owner') {
        throw new HttpsError('failed-precondition', 'No puedes modificar al propietario');
    }
    if (data.status === 'suspended') {
        await getAuth().revokeRefreshTokens(data.userId).catch(() => undefined);
    }
    await targetSnap.ref.update({ status: data.status });
    return { ok: true };
});
export const adminSetMemberRole = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 }, async (request) => {
    const ctx = requireAuth(request);
    await assertCanManageUsers(ctx);
    const data = request.data;
    if (!data.userId || typeof data.userId !== 'string') {
        throw new HttpsError('invalid-argument', 'userId requerido');
    }
    if (!data.roleId || typeof data.roleId !== 'string') {
        throw new HttpsError('invalid-argument', 'roleId requerido');
    }
    if (data.userId === ctx.uid) {
        throw new HttpsError('failed-precondition', 'No puedes cambiar tu propio cargo');
    }
    // Solo el propietario puede repartir el cargo de propietario.
    if (data.roleId === 'owner' && !isOwnerEmail(ctx.email)) {
        throw new HttpsError('permission-denied', 'Solo el propietario puede asignar ese cargo');
    }
    const roleSnap = await db
        .collection('companies')
        .doc(ctx.companyId)
        .collection('roles')
        .doc(data.roleId)
        .get();
    if (!roleSnap.exists) {
        throw new HttpsError('not-found', 'El cargo no existe en esta empresa');
    }
    const targetRef = membersRef(ctx.companyId).doc(data.userId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
        throw new HttpsError('not-found', 'Miembro no encontrado');
    }
    const target = targetSnap.data();
    if (target.role === 'owner' && !isOwnerEmail(ctx.email)) {
        throw new HttpsError('failed-precondition', 'No puedes modificar al propietario');
    }
    await targetRef.update({ role: data.roleId });
    return { ok: true };
});
export const adminDeleteUser = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 }, async (request) => {
    const ctx = requireAuth(request);
    await assertCanManageUsers(ctx);
    const data = request.data;
    if (!data.userId) {
        throw new HttpsError('invalid-argument', 'userId requerido');
    }
    if (data.userId === ctx.uid) {
        throw new HttpsError('failed-precondition', 'No puedes eliminarte a ti mismo');
    }
    const targetSnap = await db
        .collection('companies')
        .doc(ctx.companyId)
        .collection('members')
        .doc(data.userId)
        .get();
    if (targetSnap.exists) {
        const target = targetSnap.data();
        if (target.role === 'owner') {
            throw new HttpsError('failed-precondition', 'No puedes eliminar al propietario');
        }
    }
    try {
        await getAuth().deleteUser(data.userId);
    }
    catch (err) {
        const code = err.code;
        if (code !== 'auth/user-not-found') {
            throw new HttpsError('internal', `Error eliminando de Auth: ${err.message}`);
        }
    }
    await db
        .collection('companies')
        .doc(ctx.companyId)
        .collection('members')
        .doc(data.userId)
        .delete()
        .catch(() => undefined);
    return { ok: true };
});
//# sourceMappingURL=users-admin.js.map