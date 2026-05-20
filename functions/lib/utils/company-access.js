import { HttpsError } from 'firebase-functions/v2/https';
import { db } from '../firestore.js';
/**
 * Verifica que el usuario sea miembro activo de la empresa. Compartido por los
 * callables que escriben documentos de la empresa en Drive.
 */
export async function assertCompanyMember(uid, companyId) {
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection('members')
        .doc(uid)
        .get();
    if (!snap.exists) {
        throw new HttpsError('permission-denied', 'No eres miembro de esta empresa');
    }
    const m = snap.data();
    if (m.status !== 'active') {
        throw new HttpsError('permission-denied', 'Tu cuenta no está activa en esta empresa');
    }
}
//# sourceMappingURL=company-access.js.map