import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/core/firebase/config'

// Catálogo de métodos de pago por empresa. Se guarda como un único doc con un
// array de strings (mismo shape que settings/departments, pero scopeado a la
// company): companies/{companyId}/settings/paymentMethods → { list: string[] }.
// El string elegido se copia a cada transacción y de ahí fluye al Sheet, así
// que un array de nombres es suficiente — no hace falta un doc por método.
const SETTINGS_COLLECTION = 'settings'
const PAYMENT_METHODS_DOC = 'paymentMethods'

function paymentMethodsRef(companyId: string) {
  return doc(db, 'companies', companyId, SETTINGS_COLLECTION, PAYMENT_METHODS_DOC)
}

export const paymentMethodService = {
  async getList(companyId: string): Promise<string[]> {
    const snap = await getDoc(paymentMethodsRef(companyId))
    return snap.exists() ? ((snap.data().list as string[]) ?? []) : []
  },
  async setList(companyId: string, list: string[]): Promise<void> {
    await setDoc(paymentMethodsRef(companyId), { list })
  },
}
