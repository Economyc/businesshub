import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  Timestamp,
  type QueryConstraint,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './config'

export function companyCollection(companyId: string, collectionName: string) {
  return collection(db, 'companies', companyId, collectionName)
}

export function companyDoc(companyId: string, collectionName: string, docId: string) {
  return doc(db, 'companies', companyId, collectionName, docId)
}

export async function fetchCollection<T>(
  companyId: string,
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const ref = companyCollection(companyId, collectionName)
  const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[]
}

export async function fetchDocument<T>(
  companyId: string,
  collectionName: string,
  docId: string
): Promise<T | null> {
  const ref = companyDoc(companyId, collectionName, docId)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() } as T
}

export async function createDocument(
  companyId: string,
  collectionName: string,
  data: DocumentData
): Promise<string> {
  const ref = companyCollection(companyId, collectionName)
  const now = Timestamp.now()
  const docRef = await addDoc(ref, { ...data, createdAt: now, updatedAt: now })
  return docRef.id
}

export async function updateDocument(
  companyId: string,
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  const ref = companyDoc(companyId, collectionName, docId)
  await updateDoc(ref, { ...data, updatedAt: Timestamp.now() })
}

export async function removeDocument(
  companyId: string,
  collectionName: string,
  docId: string
): Promise<void> {
  const ref = companyDoc(companyId, collectionName, docId)
  await deleteDoc(ref)
}
