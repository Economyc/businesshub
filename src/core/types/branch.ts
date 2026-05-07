import type { Timestamp } from 'firebase/firestore'

export interface Branch {
  id: string
  name: string
  address?: string
  posTenantId?: string
  isActive: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export const BRANCH_ROLE_IDS = ['branch_admin', 'cashier'] as const

export function isBranchRole(roleId: string): boolean {
  return (BRANCH_ROLE_IDS as readonly string[]).includes(roleId)
}
