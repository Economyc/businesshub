import type { BankEntry, ReconciliationMatch, Transaction } from '../types'

export interface MatchResult {
  matches: ReconciliationMatch[]
  unmatchedBankEntries: string[]
  unmatchedTransactions: string[]
}

interface MatchCandidate {
  bankEntryId: string
  transactionId: string
  score: number
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dayDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T12:00:00')
  const b = new Date(dateB + 'T12:00:00')
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86400000))
}

function dateScore(diff: number): number {
  if (diff === 0) return 100
  if (diff === 1) return 80
  if (diff === 2) return 60
  if (diff === 3) return 40
  return 0
}

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

/**
 * Match bank entries against system transactions.
 * Greedy algorithm: exact amount + date proximity scoring + description bonus.
 */
export function autoMatch(
  entries: BankEntry[],
  transactions: Transaction[],
  toleranceDays = 3,
): MatchResult {
  const candidates: MatchCandidate[] = []

  for (const entry of entries) {
    const entryTxType = entry.type === 'credit' ? 'income' : 'expense'
    const entryDesc = normalizeStr(entry.description)

    for (const tx of transactions) {
      // Amount must match exactly (floating-point tolerance)
      if (Math.abs(entry.amount - tx.amount) >= 0.01) continue
      // Type must be compatible
      if (tx.type !== entryTxType) continue

      const txDate = tx.date?.toDate?.()
      if (!txDate) continue
      const txDateStr = toISODate(txDate)
      const diff = dayDiff(entry.date, txDateStr)

      if (diff > toleranceDays) continue

      let score = dateScore(diff)

      // Bonus for description match
      const txConcept = normalizeStr(tx.concept)
      if (entryDesc.includes(txConcept) || txConcept.includes(entryDesc)) {
        score = Math.min(score + 5, 100)
      }

      candidates.push({
        bankEntryId: entry.id,
        transactionId: tx.id,
        score,
      })
    }
  }

  // Sort by score descending for greedy assignment
  candidates.sort((a, b) => b.score - a.score)

  const matchedBankIds = new Set<string>()
  const matchedTxIds = new Set<string>()
  const matches: ReconciliationMatch[] = []

  for (const c of candidates) {
    if (matchedBankIds.has(c.bankEntryId) || matchedTxIds.has(c.transactionId)) continue
    matches.push({
      bankEntryId: c.bankEntryId,
      transactionId: c.transactionId,
      confidence: c.score,
      matchedBy: 'auto',
    })
    matchedBankIds.add(c.bankEntryId)
    matchedTxIds.add(c.transactionId)
  }

  const allBankIds = entries.map((e) => e.id)
  const allTxIds = transactions.map((t) => t.id)

  return {
    matches,
    unmatchedBankEntries: allBankIds.filter((id) => !matchedBankIds.has(id)),
    unmatchedTransactions: allTxIds.filter((id) => !matchedTxIds.has(id)),
  }
}

/**
 * Get match candidates for a specific bank entry, sorted by score.
 * Used in the UI when user selects an entry for manual matching.
 */
export function getCandidatesForEntry(
  entry: BankEntry,
  transactions: Transaction[],
  existingMatches: ReconciliationMatch[],
  toleranceDays = 5,
): { transactionId: string; score: number }[] {
  const matchedTxIds = new Set(existingMatches.map((m) => m.transactionId))
  const entryTxType = entry.type === 'credit' ? 'income' : 'expense'
  const entryDesc = normalizeStr(entry.description)
  const results: { transactionId: string; score: number }[] = []

  for (const tx of transactions) {
    if (matchedTxIds.has(tx.id)) continue

    const txDate = tx.date?.toDate?.()
    if (!txDate) continue
    const txDateStr = toISODate(txDate)
    const diff = dayDiff(entry.date, txDateStr)

    // For manual matching, show broader candidates
    let score = 0

    // Amount match
    if (Math.abs(entry.amount - tx.amount) < 0.01 && tx.type === entryTxType) {
      score = dateScore(Math.min(diff, 3))
      if (diff > toleranceDays) score = 10 // still show but low score
    } else if (tx.type === entryTxType && diff <= toleranceDays) {
      // Same type and close date but different amount
      score = 5
    } else {
      continue
    }

    // Description bonus
    const txConcept = normalizeStr(tx.concept)
    if (entryDesc.includes(txConcept) || txConcept.includes(entryDesc)) {
      score = Math.min(score + 5, 100)
    }

    results.push({ transactionId: tx.id, score })
  }

  return results.sort((a, b) => b.score - a.score)
}
