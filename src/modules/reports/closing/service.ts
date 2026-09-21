// Acceso a los datos del cierre mensual.
//
// Dos documentos por (compañía, mes):
//   pnl-snapshots/{ym}  base derivada de Ecore y del POS. La escribe el
//                       generador; la app sólo lee.
//   pnl-closings/{ym}   lo que se captura en pantalla. La app lee y escribe.
//
// El navegador NO lee `transactions`: el generador barre esa colección entera a
// propósito (la heurística de devengo mueve fechas sin cota, y un gasto diferido
// puede venir de años atrás). Cualquier ventana de fechas fallaría en silencio y
// dejaría la utilidad mejor de lo que es.

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import {
  closingSchema, parseClosing, emptyClosing,
  CLOSINGS_COLLECTION, SNAPSHOTS_COLLECTION,
  type ClosingDoc,
} from '@/core/pnl/closing.ts'
import type { LineAmounts, ManualItem } from '@/core/pnl/types.ts'

/** Lo que el generador publica. La app lo trata como sólo lectura. */
export interface PnlSnapshot {
  ym: string
  companyKey: string
  engineVersion: number
  generatedAt: Timestamp
  sales: {
    byLine: LineAmounts
    impoconsumo: number
    net: number
    tickets: number
    source: 'pos' | 'override'
    daysMissing: string[]
  }
  expenses: {
    accruedByLine: LineAmounts
    paidByLine: LineAmounts
    soloCausadoEcore: number
    soloPagadoEcore: number
    fueraDelPnl: number
    unclassified: { concept: string; payee: string; category: string; amount: number }[]
    prepaidSuspects: { concept: string; amount: number; payee: string }[]
    deferralsFromNotes: unknown[]
  }
  prev: {
    ym: string
    accruedByLine: LineAmounts
    manualItems: ManualItem[]
    net: number
    revenue: number
  }
  captured?: { source: 'firestore' | 'legacy' }
  totals: { accruedNet: number; paidNet: number; ebitda: number; revenue: number }
}

const snapshotRef = (companyId: string, ym: string) =>
  doc(db, 'companies', companyId, SNAPSHOTS_COLLECTION, ym)

const closingRef = (companyId: string, ym: string) =>
  doc(db, 'companies', companyId, CLOSINGS_COLLECTION, ym)

export async function fetchSnapshot(companyId: string, ym: string): Promise<PnlSnapshot | null> {
  const snap = await getDoc(snapshotRef(companyId, ym))
  return snap.exists() ? (snap.data() as PnlSnapshot) : null
}

/**
 * Devuelve siempre un cierre utilizable: si el documento no existe, uno vacío.
 * Así la pantalla se puede editar desde el primer render sin crear nada.
 */
export async function fetchClosing(companyId: string, ym: string): Promise<ClosingDoc> {
  const snap = await getDoc(closingRef(companyId, ym))
  if (!snap.exists()) return emptyClosing(ym)
  // parseClosing lanza si el documento tiene basura: mejor una pantalla en error
  // que un P&L plausible y equivocado.
  return parseClosing(snap.data(), ym) ?? emptyClosing(ym)
}

export async function saveClosing(companyId: string, closing: ClosingDoc, userEmail?: string) {
  const clean = closingSchema.parse(closing)
  const ref = closingRef(companyId, clean.ym)
  const prev = await getDoc(ref)
  await setDoc(ref, {
    ...clean,
    createdAt: prev.exists() ? (prev.data().createdAt ?? Timestamp.now()) : Timestamp.now(),
    createdBy: prev.exists() ? (prev.data().createdBy ?? userEmail ?? '') : (userEmail ?? ''),
    updatedAt: Timestamp.now(),
    ...(clean.status === 'closed' ? { closedAt: Timestamp.now(), closedBy: userEmail ?? '' } : {}),
  })
}

/** Id estable para un item nuevo. */
export const newItemId = () =>
  `it_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
