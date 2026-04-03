import type { BankEntry } from '../types'

export interface OFXParseResult {
  bankName?: string
  accountNumber?: string
  periodStart: string
  periodEnd: string
  entries: BankEntry[]
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<\\r\\n]+)`)
  const match = block.match(re)
  return match ? match[1].trim() : ''
}

function parseOFXDate(raw: string): string {
  // OFX dates: YYYYMMDD or YYYYMMDDHHMMSS or YYYYMMDDHHMMSS.XXX[TZ]
  const clean = raw.replace(/\[.*\]/, '').trim()
  const y = clean.slice(0, 4)
  const m = clean.slice(4, 6)
  const d = clean.slice(6, 8)
  return `${y}-${m}-${d}`
}

function maskAccount(acct: string): string {
  if (acct.length <= 4) return acct
  return '****' + acct.slice(-4)
}

export function parseOFX(content: string): OFXParseResult {
  const entries: BankEntry[] = []

  // Extract bank info
  const bankId = extractTag(content, 'BANKID')
  const acctId = extractTag(content, 'ACCTID')

  // Extract period dates
  const dtStart = extractTag(content, 'DTSTART')
  const dtEnd = extractTag(content, 'DTEND')

  // Extract all STMTTRN blocks
  const trnRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST|<\/STMTRS|$)/gi
  let match: RegExpExecArray | null

  while ((match = trnRegex.exec(content)) !== null) {
    const block = match[1]

    const trnType = extractTag(block, 'TRNTYPE')
    const dtPosted = extractTag(block, 'DTPOSTED')
    const trnAmt = extractTag(block, 'TRNAMT')
    const fitId = extractTag(block, 'FITID')
    const name = extractTag(block, 'NAME') || extractTag(block, 'MEMO')

    if (!dtPosted || !trnAmt) continue

    const numAmount = parseFloat(trnAmt.replace(',', '.'))
    if (isNaN(numAmount)) continue

    entries.push({
      id: crypto.randomUUID(),
      date: parseOFXDate(dtPosted),
      description: name || trnType || 'Sin descripcion',
      amount: Math.abs(numAmount),
      type: numAmount >= 0 ? 'credit' : 'debit',
      reference: fitId || undefined,
    })
  }

  // Sort by date
  entries.sort((a, b) => a.date.localeCompare(b.date))

  return {
    bankName: bankId || undefined,
    accountNumber: acctId ? maskAccount(acctId) : undefined,
    periodStart: dtStart ? parseOFXDate(dtStart) : (entries[0]?.date ?? ''),
    periodEnd: dtEnd ? parseOFXDate(dtEnd) : (entries[entries.length - 1]?.date ?? ''),
    entries,
  }
}
