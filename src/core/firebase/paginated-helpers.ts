import {
  getDocs,
  query,
  limit,
  startAfter,
  getCountFromServer,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { companyCollection } from './helpers'

export interface PaginatedResult<T> {
  items: T[]
  lastDoc: QueryDocumentSnapshot | null
  hasMore: boolean
}

export async function fetchPaginatedCollection<T>(
  companyId: string,
  collectionName: string,
  pageSize: number,
  cursor: QueryDocumentSnapshot | null,
  ...constraints: QueryConstraint[]
): Promise<PaginatedResult<T>> {
  const ref = companyCollection(companyId, collectionName)
  const queryConstraints: QueryConstraint[] = [
    ...constraints,
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize + 1),
  ]
  const q = query(ref, ...queryConstraints)
  const snapshot = await getDocs(q)
  const hasMore = snapshot.docs.length > pageSize
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs
  return {
    items: docs.map((doc) => ({ id: doc.id, ...doc.data() })) as T[],
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  }
}

export async function fetchCollectionCount(
  companyId: string,
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<number> {
  const ref = companyCollection(companyId, collectionName)
  const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref)
  const snapshot = await getCountFromServer(q)
  return snapshot.data().count
}
