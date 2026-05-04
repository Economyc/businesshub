import { partnerService } from '@/modules/partners/services'
import { talentService } from '@/modules/talent/services'
import { supplierService } from '@/modules/suppliers/services'
import type { PayeeType, PayeeRef } from '@/modules/finance/types'
import type { Company } from '@/core/types'

export type PayeeResolution =
  | { ok: true; payee: PayeeRef }
  | { ok: false; reason: 'not_found'; type: PayeeType; name: string }
  | { ok: false; reason: 'ambiguous'; matches: Array<{ id: string; name: string }> }

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

async function fetchByType(
  companyId: string,
  type: Exclude<PayeeType, 'external'>,
): Promise<Array<{ id: string; name: string }>> {
  if (type === 'partner') {
    const list = await partnerService.getAll(companyId)
    return list.map((p) => ({ id: p.id, name: p.name }))
  }
  if (type === 'employee') {
    const list = await talentService.getAll(companyId)
    return list.map((e) => ({ id: e.id, name: e.name }))
  }
  const list = await supplierService.getAll(companyId)
  return list.map((s) => ({ id: s.id, name: s.name }))
}

export async function resolvePayeeOnCompany(
  companyId: string,
  type: PayeeType,
  name: string,
): Promise<PayeeResolution> {
  if (type === 'external') {
    return { ok: true, payee: { type, id: 'external', name } }
  }

  const candidates = await fetchByType(companyId, type)
  const target = normalize(name)
  if (!target) return { ok: false, reason: 'not_found', type, name }

  const exact = candidates.filter((c) => normalize(c.name) === target)
  if (exact.length === 1) return { ok: true, payee: { type, id: exact[0].id, name: exact[0].name } }
  if (exact.length > 1) return { ok: false, reason: 'ambiguous', matches: exact }

  const partial = candidates.filter((c) => {
    const n = normalize(c.name)
    return n.includes(target) || target.includes(n)
  })
  if (partial.length === 1) return { ok: true, payee: { type, id: partial[0].id, name: partial[0].name } }
  if (partial.length > 1) return { ok: false, reason: 'ambiguous', matches: partial }

  return { ok: false, reason: 'not_found', type, name }
}

export type CompanyResolution =
  | { ok: true; company: Company }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'ambiguous'; matches: Company[] }

export function resolveCompany(input: string, companies: Company[]): CompanyResolution {
  const target = normalize(input)
  if (!target) return { ok: false, reason: 'not_found' }

  const byId = companies.find((c) => c.id === input.trim())
  if (byId) return { ok: true, company: byId }

  const bySlug = companies.find((c) => normalize(c.slug ?? '') === target)
  if (bySlug) return { ok: true, company: bySlug }

  const fullName = (c: Company) => normalize(`${c.name} ${c.location ?? ''}`)
  const byFull = companies.find((c) => fullName(c) === target)
  if (byFull) return { ok: true, company: byFull }

  const byLocation = companies.filter((c) => c.location && normalize(c.location) === target)
  if (byLocation.length === 1) return { ok: true, company: byLocation[0] }

  const byName = companies.filter((c) => normalize(c.name) === target)
  if (byName.length === 1) return { ok: true, company: byName[0] }

  const contains = companies.filter((c) => {
    const n = normalize(c.name)
    const loc = normalize(c.location ?? '')
    return (
      (n && (n.includes(target) || target.includes(n))) ||
      (loc && (loc.includes(target) || target.includes(loc)))
    )
  })
  if (contains.length === 1) return { ok: true, company: contains[0] }
  if (contains.length > 1) return { ok: false, reason: 'ambiguous', matches: contains }

  return { ok: false, reason: 'not_found' }
}
