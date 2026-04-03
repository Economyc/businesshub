import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp()
}

export const db = getFirestore()

export async function fetchCollection(
  companyId: string,
  collectionName: string,
): Promise<Record<string, unknown>[]> {
  const snapshot = await db
    .collection('companies')
    .doc(companyId)
    .collection(collectionName)
    .get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

export async function fetchDocument(
  companyId: string,
  collectionName: string,
  docId: string,
): Promise<Record<string, unknown> | null> {
  const doc = await db
    .collection('companies')
    .doc(companyId)
    .collection(collectionName)
    .doc(docId)
    .get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() }
}

export async function fetchSettingsDoc(
  companyId: string,
  settingsName: string,
): Promise<Record<string, unknown> | null> {
  const doc = await db
    .collection('companies')
    .doc(companyId)
    .collection('settings')
    .doc(settingsName)
    .get()
  if (!doc.exists) return null
  return doc.data() as Record<string, unknown>
}
