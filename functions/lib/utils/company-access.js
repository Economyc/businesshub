import { HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { db } from '../firestore.js';
// Emails del owner de la plataforma. Espejo de `OWNER_EMAIL` del cliente
// (`src/core/config/access-registry.ts` — mismo valor en BusinessHub y Ecore).
// El owner opera cualquier empresa aunque NO tenga doc en `members/{uid}`,
// igual que el bypass por email del front (CompanyProvider). Sin esto, el owner
// ve/selecciona empresas en la UI pero cualquier callable que valide membresía
// le devuelve 403 "No eres miembro de esta empresa".
const OWNER_EMAILS = new Set(['admin@filipoblue.co']);
/**
 * ¿El uid corresponde al owner de la plataforma? Resuelve el email vía Auth.
 * Se llama SOLO en el camino de fallo de `assertCompanyMember` para no pagar
 * un getUser() en cada invocación de un miembro normal.
 */
async function isPlatformOwner(uid) {
    try {
        const u = await getAuth().getUser(uid);
        return !!u.email && OWNER_EMAILS.has(u.email.toLowerCase());
    }
    catch {
        return false;
    }
}
/**
 * Verifica que el usuario sea miembro activo de la empresa. Compartido por los
 * callables que escriben documentos de la empresa en Drive. El owner de la
 * plataforma bypasea el check (alineado con el cliente).
 */
export async function assertCompanyMember(uid, companyId) {
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection('members')
        .doc(uid)
        .get();
    if (!snap.exists) {
        if (await isPlatformOwner(uid))
            return;
        throw new HttpsError('permission-denied', 'No eres miembro de esta empresa');
    }
    const m = snap.data();
    if (m.status !== 'active') {
        if (await isPlatformOwner(uid))
            return;
        throw new HttpsError('permission-denied', 'Tu cuenta no está activa en esta empresa');
    }
}
//# sourceMappingURL=company-access.js.map