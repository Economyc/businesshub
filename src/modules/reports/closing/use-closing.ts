// Estado del cierre mensual: lee la base publicada, la mezcla con lo capturado
// y arma el P&L en memoria con el MISMO motor que usa el generador.
//
// Por eso la pantalla no puede decir un número distinto al del .xlsx: la base
// llega ya calculada y lo capturado entra de forma puramente aditiva.

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { useAuth } from '@/core/hooks/use-auth'
import { buildStatement } from '@/core/pnl/statement.ts'
import { buildBridge } from '@/core/pnl/bridge.ts'
import { missingLines } from '@/core/pnl/missing.ts'
import { monthRange } from '@/core/pnl/month.ts'
import type { ClosingDoc } from '@/core/pnl/closing.ts'
import { fetchSnapshot, fetchClosing, saveClosing, type PnlSnapshot } from './service'

export function useClosing(ym: string) {
  const { selectedCompany } = useCompany()
  const { user } = useAuth()
  const companyId = selectedCompany?.id
  const queryClient = useQueryClient()

  const snapshotQuery = useQuery({
    queryKey: ['firestore', companyId, 'pnl-snapshots', ym],
    queryFn: () => fetchSnapshot(companyId!, ym),
    enabled: !!companyId,
    staleTime: 60_000,
  })

  const closingQuery = useQuery({
    queryKey: ['firestore', companyId, 'pnl-closings', ym],
    queryFn: () => fetchClosing(companyId!, ym),
    enabled: !!companyId,
    staleTime: 60_000,
  })

  // Borrador local: la edición es inmediata y el guardado explícito, para no
  // escribir a Firestore en cada tecla de un campo de dinero.
  const [draft, setDraft] = useState<ClosingDoc | null>(null)
  useEffect(() => {
    if (closingQuery.data) setDraft(closingQuery.data)
  }, [closingQuery.data])

  const dirty = useMemo(() => {
    if (!draft || !closingQuery.data) return false
    return JSON.stringify(draft) !== JSON.stringify(closingQuery.data)
  }, [draft, closingQuery.data])

  const save = useMutation({
    mutationFn: (next: ClosingDoc) => saveClosing(companyId!, next, user?.email ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firestore', companyId, 'pnl-closings', ym] })
    },
  })

  const snapshot = snapshotQuery.data ?? null
  const preview = useMemo(() => buildPreview(snapshot, draft, ym), [snapshot, draft, ym])

  const discard = useCallback(() => {
    if (closingQuery.data) setDraft(closingQuery.data)
  }, [closingQuery.data])

  return {
    snapshot,
    draft,
    setDraft,
    preview,
    dirty,
    discard,
    save,
    loading: snapshotQuery.isLoading || closingQuery.isLoading,
    error: (snapshotQuery.error ?? closingQuery.error) as Error | null,
    hasSnapshot: !!snapshot,
  }
}

export interface ClosingPreview {
  statement: ReturnType<typeof buildStatement>
  bridge: ReturnType<typeof buildBridge>
  missing: ReturnType<typeof missingLines>
}

/**
 * base(snapshot) ⊕ overlay(capturado), con el mismo motor que el generador.
 * Sin snapshot no hay preview: inventar una base con ceros mostraría una
 * utilidad enorme y falsa, que es exactamente el error a evitar.
 */
export function buildPreview(
  snapshot: PnlSnapshot | null,
  closing: ClosingDoc | null,
  ym: string,
): ClosingPreview | null {
  if (!snapshot) return null

  const manualItems = closing?.manualAdjustments.items ?? []
  const nonOperatingItems = closing?.nonOperatingIncome ?? []
  const incomeNotReceived = closing?.incomeNotReceived ?? []

  const statement = buildStatement({
    salesByLine: snapshot.sales.byLine,
    impoconsumo: snapshot.sales.impoconsumo,
    accruedByLine: snapshot.expenses.accruedByLine,
    paidByLine: snapshot.expenses.paidByLine,
    manualItems,
    nonOperatingItems,
  })

  const bridge = buildBridge({
    monthLabel: monthRange(ym).label,
    net: statement.accrued.net,
    soloCausadoEcore: snapshot.expenses.soloCausadoEcore,
    soloPagadoEcore: snapshot.expenses.soloPagadoEcore,
    fueraDelPnl: snapshot.expenses.fueraDelPnl,
    impoAccrued: statement.accrued.values.tax_impo ?? 0,
    impoPaid: statement.paid.values.tax_impo ?? 0,
    manualItems,
    incomeNotReceived,
  })

  const missing = missingLines({
    curByLine: snapshot.expenses.accruedByLine,
    prevByLine: snapshot.prev?.accruedByLine ?? {},
    curManual: manualItems,
    prevManual: snapshot.prev?.manualItems ?? [],
  })

  return { statement, bridge, missing }
}
