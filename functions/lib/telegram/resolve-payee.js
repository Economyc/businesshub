// Port server-side de src/modules/agent/utils/resolve-payee.ts.
// Misma semántica de matching (normalize + exact/partial) pero leyendo con
// Admin SDK vía fetchCollection (que ya respeta `suppliers` como colección raíz).
import { fetchCollection } from '../firestore.js';
function normalize(s) {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}
const COLLECTION_BY_TYPE = {
    partner: 'partners',
    employee: 'employees',
    supplier: 'suppliers',
};
async function fetchByType(companyId, type) {
    const docs = await fetchCollection(companyId, COLLECTION_BY_TYPE[type]);
    return docs
        .map((d) => ({ id: String(d.id), name: String(d.name ?? '') }))
        .filter((d) => d.name.length > 0);
}
export async function resolvePayeeOnCompany(companyId, type, name) {
    if (type === 'external') {
        return { ok: true, payee: { type, id: 'external', name } };
    }
    const candidates = await fetchByType(companyId, type);
    const target = normalize(name);
    if (!target)
        return { ok: false, reason: 'not_found', type, name };
    const exact = candidates.filter((c) => normalize(c.name) === target);
    if (exact.length === 1)
        return { ok: true, payee: { type, id: exact[0].id, name: exact[0].name } };
    if (exact.length > 1)
        return { ok: false, reason: 'ambiguous', matches: exact };
    const partial = candidates.filter((c) => {
        const n = normalize(c.name);
        return n.includes(target) || target.includes(n);
    });
    if (partial.length === 1)
        return { ok: true, payee: { type, id: partial[0].id, name: partial[0].name } };
    if (partial.length > 1)
        return { ok: false, reason: 'ambiguous', matches: partial };
    return { ok: false, reason: 'not_found', type, name };
}
function tokenize(s) {
    return normalize(s)
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}
export function resolveCompany(input, companies) {
    const trimmed = input.trim();
    if (!trimmed)
        return { ok: false, reason: 'not_found' };
    const byId = companies.find((c) => c.id === trimmed);
    if (byId)
        return { ok: true, company: byId };
    const target = normalize(input);
    const bySlug = companies.find((c) => normalize(c.slug ?? '') === target);
    if (bySlug)
        return { ok: true, company: bySlug };
    const inputTokens = tokenize(input);
    if (inputTokens.length === 0)
        return { ok: false, reason: 'not_found' };
    const scored = companies.map((c) => {
        const haystack = new Set([...tokenize(c.name), ...tokenize(c.location ?? '')]);
        const matched = inputTokens.filter((t) => haystack.has(t)).length;
        return { company: c, matched, haySize: haystack.size };
    });
    const fullMatches = scored.filter((s) => s.matched === inputTokens.length);
    if (fullMatches.length === 1)
        return { ok: true, company: fullMatches[0].company };
    if (fullMatches.length > 1) {
        const exact = fullMatches.filter((s) => s.haySize === inputTokens.length);
        if (exact.length === 1)
            return { ok: true, company: exact[0].company };
        return { ok: false, reason: 'ambiguous', matches: fullMatches.map((s) => s.company) };
    }
    const partial = scored.filter((s) => s.matched > 0);
    if (partial.length === 1)
        return { ok: true, company: partial[0].company };
    if (partial.length > 1) {
        const best = Math.max(...partial.map((s) => s.matched));
        const top = partial.filter((s) => s.matched === best);
        if (top.length === 1)
            return { ok: true, company: top[0].company };
        return { ok: false, reason: 'ambiguous', matches: top.map((s) => s.company) };
    }
    return { ok: false, reason: 'not_found' };
}
//# sourceMappingURL=resolve-payee.js.map