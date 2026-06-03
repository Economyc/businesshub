import { Timestamp } from 'firebase/firestore'
import { aggregateReceipts, aggregateAdjustments } from './aggregate-movements'
import type { InventoryReceipt, InventoryAdjustment } from '../types'

const ts = (ymd: string) => Timestamp.fromDate(new Date(`${ymd}T12:00:00`))
const anchor = ts('2026-06-01').toMillis()

function receipt(receivedAt: string, lines: InventoryReceipt['lines']): InventoryReceipt {
  return {
    id: receivedAt,
    receivedAt: ts(receivedAt),
    lines,
    createdAt: ts(receivedAt),
    updatedAt: ts(receivedAt),
  } as InventoryReceipt
}

function adjustment(occurredAt: string, lines: InventoryAdjustment['lines']): InventoryAdjustment {
  return {
    id: occurredAt,
    occurredAt: ts(occurredAt),
    type: 'merma',
    by: 'tester',
    lines,
    createdAt: ts(occurredAt),
    updatedAt: ts(occurredAt),
  } as InventoryAdjustment
}

describe('aggregateReceipts', () => {
  it('convierte la cantidad de compra a stock con el factor del insumo', () => {
    // 2 kg de carne, factor 1000 (kg→g) = 2000 g
    const result = aggregateReceipts(
      [receipt('2026-06-05', [{ itemId: 'carne', qty: 2 }])],
      { carne: 1000 },
      anchor,
    )
    expect(result).toEqual({ carne: 2000 })
  })

  it('usa factor 1 cuando el insumo no está en el mapa de factores', () => {
    const result = aggregateReceipts(
      [receipt('2026-06-05', [{ itemId: 'gaseosa', qty: 24 }])],
      {},
      anchor,
    )
    expect(result).toEqual({ gaseosa: 24 })
  })

  it('ignora entradas en o antes del conteo ancla', () => {
    const result = aggregateReceipts(
      [
        receipt('2026-06-01', [{ itemId: 'carne', qty: 5 }]), // misma fecha del ancla → fuera
        receipt('2026-05-20', [{ itemId: 'carne', qty: 3 }]), // anterior → fuera
        receipt('2026-06-10', [{ itemId: 'carne', qty: 2 }]), // posterior → cuenta
      ],
      { carne: 1000 },
      anchor,
    )
    expect(result).toEqual({ carne: 2000 })
  })

  it('suma múltiples líneas y documentos por insumo', () => {
    const result = aggregateReceipts(
      [
        receipt('2026-06-05', [
          { itemId: 'carne', qty: 1 },
          { itemId: 'pan', qty: 10 },
        ]),
        receipt('2026-06-08', [{ itemId: 'carne', qty: 2 }]),
      ],
      { carne: 1000, pan: 1 },
      anchor,
    )
    expect(result).toEqual({ carne: 3000, pan: 10 })
  })

  it('descarta cantidades inválidas o no positivas', () => {
    const result = aggregateReceipts(
      [receipt('2026-06-05', [{ itemId: 'carne', qty: 0 }, { itemId: 'pan', qty: -3 }])],
      { carne: 1000, pan: 1 },
      anchor,
    )
    expect(result).toEqual({})
  })
})

describe('aggregateAdjustments', () => {
  it('suma qtyDelta (ya en stock) de ajustes posteriores al ancla', () => {
    const result = aggregateAdjustments(
      [adjustment('2026-06-05', [{ itemId: 'carne', qtyDelta: 500 }])],
      anchor,
    )
    expect(result).toEqual({ carne: 500 })
  })

  it('ignora ajustes en o antes del ancla', () => {
    const result = aggregateAdjustments(
      [
        adjustment('2026-05-30', [{ itemId: 'carne', qtyDelta: 200 }]),
        adjustment('2026-06-07', [{ itemId: 'carne', qtyDelta: 300 }]),
      ],
      anchor,
    )
    expect(result).toEqual({ carne: 300 })
  })

  it('suma múltiples líneas y documentos por insumo', () => {
    const result = aggregateAdjustments(
      [
        adjustment('2026-06-05', [
          { itemId: 'carne', qtyDelta: 100 },
          { itemId: 'pan', qtyDelta: 5 },
        ]),
        adjustment('2026-06-09', [{ itemId: 'carne', qtyDelta: 50 }]),
      ],
      anchor,
    )
    expect(result).toEqual({ carne: 150, pan: 5 })
  })

  it('descarta deltas cero o inválidos', () => {
    const result = aggregateAdjustments(
      [adjustment('2026-06-05', [{ itemId: 'carne', qtyDelta: 0 }])],
      anchor,
    )
    expect(result).toEqual({})
  })
})
