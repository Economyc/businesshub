import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import type { PaymentMethod } from './types'

// Catálogo de métodos de pago por empresa. Se guarda como un único doc con un
// array de objetos PaymentMethod: companies/{companyId}/settings/paymentMethods
// → { list: PaymentMethod[] }. El `name` de cada método es lo que se copia a la
// transacción y fluye al Sheet.
const SETTINGS_COLLECTION = 'settings'
const PAYMENT_METHODS_DOC = 'paymentMethods'

function paymentMethodsRef(companyId: string) {
  return doc(db, 'companies', companyId, SETTINGS_COLLECTION, PAYMENT_METHODS_DOC)
}

// Normaliza data legacy: el catálogo original guardaba strings sueltos. Si un
// elemento viene como string, lo envolvemos como método tipo 'other'.
function normalize(raw: unknown, index: number): PaymentMethod {
  if (typeof raw === 'string') {
    return { id: `legacy-${index}-${raw}`, name: raw, type: 'other' }
  }
  const m = raw as Partial<PaymentMethod>
  return {
    id: m.id ?? `m-${index}`,
    name: m.name ?? '',
    type: m.type ?? 'other',
    ...(m.entity ? { entity: m.entity } : {}),
    ...(m.last4 ? { last4: m.last4 } : {}),
  }
}

export const paymentMethodService = {
  async getList(companyId: string): Promise<PaymentMethod[]> {
    const snap = await getDoc(paymentMethodsRef(companyId))
    if (!snap.exists()) return []
    const raw = (snap.data().list as unknown[]) ?? []
    return raw.map(normalize)
  },
  async setList(companyId: string, list: PaymentMethod[]): Promise<void> {
    await setDoc(paymentMethodsRef(companyId), { list })
  },
}
