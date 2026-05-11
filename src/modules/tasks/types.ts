import type { Timestamp } from 'firebase/firestore'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'done'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface TaskCompanyTag {
  id: string
  name: string
  color?: string
}

export interface Task {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  subtasks: Subtask[]
  note?: string
  companyTag?: TaskCompanyTag
  order?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
