import { Timestamp } from 'firebase/firestore'
import {
  fetchCollection,
  fetchDocument,
  createDocument,
  updateDocument,
  removeDocument,
} from '@/core/firebase/helpers'
import type { Branch } from '@/core/types/branch'

const COLLECTION = 'branches'

export async function fetchBranches(companyId: string): Promise<Branch[]> {
  return fetchCollection<Branch>(companyId, COLLECTION)
}

export async function fetchBranch(companyId: string, branchId: string): Promise<Branch | null> {
  return fetchDocument<Branch>(companyId, COLLECTION, branchId)
}

export interface BranchInput {
  name: string
  address?: string
  posTenantId?: string
  isActive: boolean
}

function normalize(input: BranchInput): Record<string, unknown> {
  const data: Record<string, unknown> = {
    name: input.name.trim(),
    isActive: input.isActive,
  }
  const address = input.address?.trim()
  if (address) data.address = address
  const posTenantId = input.posTenantId?.trim()
  if (posTenantId) data.posTenantId = posTenantId
  return data
}

export async function createBranch(companyId: string, input: BranchInput): Promise<string> {
  return createDocument(companyId, COLLECTION, normalize(input))
}

export async function updateBranch(
  companyId: string,
  branchId: string,
  input: BranchInput,
): Promise<void> {
  const data = normalize(input)
  // Clear optional fields explicitly when emptied so Firestore drops them
  if (!input.address?.trim()) data.address = null
  if (!input.posTenantId?.trim()) data.posTenantId = null
  await updateDocument(companyId, COLLECTION, branchId, {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function setBranchActive(
  companyId: string,
  branchId: string,
  isActive: boolean,
): Promise<void> {
  await updateDocument(companyId, COLLECTION, branchId, {
    isActive,
    updatedAt: Timestamp.now(),
  })
}

export async function removeBranch(companyId: string, branchId: string): Promise<void> {
  await removeDocument(companyId, COLLECTION, branchId)
}
