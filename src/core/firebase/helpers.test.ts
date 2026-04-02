import { vi } from 'vitest'
import { fakeTimestamp } from '@/test/mocks/firebase'

const mockGetDocs = vi.fn()
const mockGetDoc = vi.fn()
const mockAddDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockDeleteDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args: string[]) => args.join('/')),
  doc: vi.fn((...args: string[]) => args.join('/')),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  query: vi.fn((...args: any[]) => args[0]),
  Timestamp: {
    now: () => fakeTimestamp(new Date('2024-06-15T12:00:00')),
  },
}))

vi.mock('./config', () => ({
  db: 'mock-db',
}))

import { companyCollection, companyDoc, fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from './helpers'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('companyCollection', () => {
  it('returns collection reference with correct path', () => {
    const result = companyCollection('comp1', 'transactions')
    expect(result).toBe('mock-db/companies/comp1/transactions')
  })
})

describe('companyDoc', () => {
  it('returns doc reference with correct path', () => {
    const result = companyDoc('comp1', 'transactions', 'tx1')
    expect(result).toBe('mock-db/companies/comp1/transactions/tx1')
  })
})

describe('fetchCollection', () => {
  it('returns array of documents with id', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'doc1', data: () => ({ name: 'Test 1' }) },
        { id: 'doc2', data: () => ({ name: 'Test 2' }) },
      ],
    })

    const result = await fetchCollection<{ id: string; name: string }>('comp1', 'items')
    expect(result).toEqual([
      { id: 'doc1', name: 'Test 1' },
      { id: 'doc2', name: 'Test 2' },
    ])
  })

  it('returns empty array when no documents', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })
    const result = await fetchCollection('comp1', 'items')
    expect(result).toEqual([])
  })
})

describe('fetchDocument', () => {
  it('returns document with id when exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'doc1',
      data: () => ({ name: 'Test' }),
    })

    const result = await fetchDocument<{ id: string; name: string }>('comp1', 'items', 'doc1')
    expect(result).toEqual({ id: 'doc1', name: 'Test' })
  })

  it('returns null when document does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    const result = await fetchDocument('comp1', 'items', 'nonexistent')
    expect(result).toBeNull()
  })
})

describe('createDocument', () => {
  it('creates document with createdAt and updatedAt timestamps', async () => {
    mockAddDoc.mockResolvedValue({ id: 'new-doc' })

    const result = await createDocument('comp1', 'items', { name: 'New' })

    expect(result).toBe('new-doc')
    const callData = mockAddDoc.mock.calls[0][1]
    expect(callData.name).toBe('New')
    expect(callData.createdAt).toBeDefined()
    expect(callData.updatedAt).toBeDefined()
  })
})

describe('updateDocument', () => {
  it('updates document with updatedAt timestamp only', async () => {
    mockUpdateDoc.mockResolvedValue(undefined)

    await updateDocument('comp1', 'items', 'doc1', { name: 'Updated' })

    const callData = mockUpdateDoc.mock.calls[0][1]
    expect(callData.name).toBe('Updated')
    expect(callData.updatedAt).toBeDefined()
    expect(callData.createdAt).toBeUndefined()
  })
})

describe('removeDocument', () => {
  it('calls deleteDoc with correct reference', async () => {
    mockDeleteDoc.mockResolvedValue(undefined)
    await removeDocument('comp1', 'items', 'doc1')
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
  })
})
