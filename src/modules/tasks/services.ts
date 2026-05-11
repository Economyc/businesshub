import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import type { Task, TaskInput } from './types'

const tasksCollection = (uid: string) => collection(db, 'users', uid, 'tasks')
const taskDoc = (uid: string, id: string) => doc(db, 'users', uid, 'tasks', id)

export const tasksService = {
  async getAll(uid: string): Promise<Task[]> {
    const q = query(tasksCollection(uid), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))
  },

  async create(uid: string, data: TaskInput): Promise<string> {
    const ref = await addDoc(tasksCollection(uid), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },

  async update(uid: string, id: string, data: Partial<TaskInput>): Promise<void> {
    await updateDoc(taskDoc(uid, id), {
      ...data,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    })
  },

  async remove(uid: string, id: string): Promise<void> {
    await deleteDoc(taskDoc(uid, id))
  },
}
