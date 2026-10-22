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
/**
 * Normalización agresiva (también quita puntuación) usada solo por el scorer
 * fuzzy. Espejo de la de analyze-invoice-document.ts para que web y bot
 * matcheen igual.
 */
function normalizeFuzzy(s) {
    return (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
/** Distancia de Levenshtein (edición) entre dos strings cortos. */
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0)
        return n;
    if (n === 0)
        return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    let cur = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
        cur[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        }
        ;
        [prev, cur] = [cur, prev];
    }
    return prev[n];
}
/** ¿Dos tokens son "casi" el mismo? (idéntico o ≤20% de ediciones). Captura
 * variantes de OCR/tipeo como "carner" ≈ "carnes". */
function tokenClose(t, set) {
    for (const u of set) {
        if (t === u)
            return true;
        const maxLen = Math.max(t.length, u.length);
        if (maxLen >= 4 && 1 - levenshtein(t, u) / maxLen >= 0.8)
            return true;
    }
    return false;
}
/**
 * Puntaje de similitud entre el proveedor extraído del documento y un
 * proveedor registrado. exact=1.0, inclusión=0.85; si no, fracción de tokens
 * (>2 chars) que tienen un casi-gemelo en el otro (tolera OCR/tipeo). Rango [0,1].
 */
export function similarSupplier(extractedName, supplierName) {
    const a = normalizeFuzzy(extractedName);
    const b = normalizeFuzzy(supplierName);
    if (!a || !b)
        return 0;
    if (a === b)
        return 1;
    if (a.includes(b) || b.includes(a))
        return 0.85;
    const ta = new Set(a.split(' ').filter((x) => x.length > 2));
    const tb = new Set(b.split(' ').filter((x) => x.length > 2));
    if (ta.size === 0 || tb.size === 0)
        return 0;
    let shared = 0;
    for (const t of ta)
        if (tokenClose(t, tb))
            shared++;
    return shared / Math.max(ta.size, tb.size);
}
/** Umbral mínimo de aceptación del fuzzy-match (idéntico al de la web). */
const FUZZY_THRESHOLD = 0.5;
const COLLECTION_BY_TYPE = {
    partner: 'partners',
    employee: 'employees',
    supplier: 'suppliers',
};
async function fetchByType(companyId, type) {
    const docs = await fetchCollection(companyId, COLLECTION_BY_TYPE[type]);
    return docs
        .map((d) => ({
        id: String(d.id),
        name: String(d.name ?? ''),
        category: d.category ? String(d.category) : undefined,
    }))
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
    const hit = (c) => ({
        ok: true,
        payee: { type, id: c.id, name: c.name },
        supplierCategory: c.category,
    });
    const exact = candidates.filter((c) => normalize(c.name) === target);
    if (exact.length === 1)
        return hit(exact[0]);
    if (exact.length > 1)
        return { ok: false, reason: 'ambiguous', matches: exact };
    const partial = candidates.filter((c) => {
        const n = normalize(c.name);
        return n.includes(target) || target.includes(n);
    });
    if (partial.length === 1)
        return hit(partial[0]);
    if (partial.length > 1)
        return { ok: false, reason: 'ambiguous', matches: partial };
    // Backstop fuzzy (mismo scorer/umbral que la web): atrapa variantes como
    // "Super Carner Walter" ≈ "Carnes Walter" que exact/inclusión no capturan.
    const scored = candidates
        .map((c) => ({ c, score: similarSupplier(name, c.name) }))
        .filter((s) => s.score >= FUZZY_THRESHOLD)
        .sort((a, b) => b.score - a.score);
    if (scored.length === 1)
        return hit(scored[0].c);
    if (scored.length > 1) {
        // Ganador claro (margen) → lo tomamos; empate cercano → ambiguo.
        if (scored[0].score - scored[1].score >= 0.15)
            return hit(scored[0].c);
        return { ok: false, reason: 'ambiguous', matches: scored.map((s) => ({ id: s.c.id, name: s.c.name })) };
    }
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