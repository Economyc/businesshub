import { vi } from 'vitest'
import { fakeTimestamp } from '@/test/mocks/firebase'

// Mock firebase/firestore
const mockBatchSet = vi.fn()
const mockBatchDelete = vi.fn()
const mockBatchCommit = vi.fn().mockResolvedValue(undefined)

vi.mock('firebase/firestore', () => ({
  writeBatch: vi.fn(() => ({
    set: mockBatchSet,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  })),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn(() => ({ id: 'mock-doc-id' })),
  Timestamp: {
    now: () => fakeTimestamp(new Date('2024-06-15T12:00:00')),
    fromDate: (d: Date) => fakeTimestamp(d),
  },
  collection: vi.fn(),
}))

vi.mock('@/core/firebase/config', () => ({
  db: {},
}))

vi.mock('@/core/firebase/helpers', () => ({
  companyCollection: vi.fn(() => 'mock-collection-ref'),
}))

vi.mock('@/core/query/invalidation', () => ({
  invalidateCollection: vi.fn(),
}))

import { getDocs } from 'firebase/firestore'
import { invalidateCollection } from '@/core/query/invalidation'
import { deleteLinkedTransactions, syncClosingTransactions } from './transaction-sync'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('deleteLinkedTransactions', () => {
  it('deletes all matching documents in a batch', async () => {
    const mockDocs = [
      { ref: { id: 'doc1' } },
      { ref: { id: 'doc2' } },
    ]
    vi.mocked(getDocs).mockResolvedValue({
      empty: false,
      docs: mockDocs,
    } as any)

    await deleteLinkedTransactions('company1', 'closing', 'closing1')

    expect(mockBatchDelete).toHaveBeenCalledTimes(2)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })

  it('does nothing when snapshot is empty', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      empty: true,
      docs: [],
    } as any)

    await deleteLinkedTransactions('company1', 'closing', 'closing1')

    expect(mockBatchDelete).not.toHaveBeenCalled()
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })
})

describe('syncClosingTransactions', () => {
  const baseClosing = {
    date: '2024-06-15',
    ap: 100000,
    efectivo: 500000,
    datafono: 200000,
    qr: 50000,
    rappiVentas: 80000,
    propinas: 15000,
    gastos: 30000,
    cajaMenor: 0,
    entregaEfectivo: 0,
    responsable: 'Juan',
    ventaTotal: 730000,
  }

  beforeEach(() => {
    // deleteLinkedTransactions needs empty snapshot
    vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as any)
  })

  it('creates transactions for non-zero channels', async () => {
    await syncClosingTransactions('company1', 'closing1', baseClosing)

    // efectivoNeto(400000) + datafono(200000) + qr(50000) + rappi(80000) + propinas(15000) + gastos(30000) = 6 transactions
    expect(mockBatchSet).toHaveBeenCalledTimes(6)
    expect(mockBatchCommit).toHaveBeenCalled()
  })

  it('calculates efectivoNeto as max(efectivo - ap, 0)', async () => {
    await syncClosingTransactions('company1', 'closing1', {
      ...baseClosing,
      efectivo: 50000,
      ap: 100000,  // ap > efectivo → efectivoNeto = 0
      datafono: 0,
      qr: 0,
      rappiVentas: 0,
      propinas: 0,
      gastos: 0,
    })

    // All channels are 0 → no transactions created
    expect(mockBatchSet).not.toHaveBeenCalled()
  })

  it('does NOT create transaction for zero-amount channels', async () => {
    await syncClosingTransactions('company1', 'closing1', {
      ...baseClosing,
      datafono: 0,
      qr: 0,
      rappiVentas: 0,
      propinas: 0,
      gastos: 0,
    })

    // Only efectivoNeto (400000) > 0
    expect(mockBatchSet).toHaveBeenCalledTimes(1)
  })

  it('sets Rappi as "pending" status', async () => {
    await syncClosingTransactions('company1', 'closing1', {
      ...baseClosing,
      efectivo: 0,
      ap: 0,
      datafono: 0,
      qr: 0,
      propinas: 0,
      gastos: 0,
      rappiVentas: 80000,  // only Rappi
    })

    const setCall = mockBatchSet.mock.calls[0][1]
    expect(setCall.status).toBe('pending')
    expect(setCall.category).toBe('Ventas')
  })

  it('invalidates cache after sync', async () => {
    await syncClosingTransactions('company1', 'closing1', baseClosing)
    expect(invalidateCollection).toHaveBeenCalledWith('company1', 'transactions')
  })
})

