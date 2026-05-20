import { HttpsError } from 'firebase-functions/v2/https'
import { db } from '../firestore.js'

interface MemberDoc {
  userId: string
  role: string
  status: 'active' | 'invited' | 'suspended'
}

/**
 * Verifica que el usuario sea miembro activo de la empresa. Compartido por los
 * callables que escriben documentos de la empresa en Drive.
 */
export async function assertCompanyMember(uid: string, companyId: string): Promise<void> {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('members')
    .doc(uid)
    .get()
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No eres miembro de esta empresa')
  }
  const m = snap.data() as MemberDoc
  if (m.status !== 'active') {
    throw new HttpsError('permission-denied', 'Tu cuenta no está activa en esta empresa')
  }
}
