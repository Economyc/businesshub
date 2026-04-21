// Port server-side de src/modules/pos-sync/company-mapping.ts.
// Mantener las reglas idénticas para que el cron hidrate cache usando el
// mismo mapeo company↔local que luego ve el cliente.
//
// Multi-tenant: cada tenant tiene su propio set de `locales` (proveniente
// de su POS), y sus propias companies en Firestore (identificadas por
// `posTenantId`). El mapping corre por tenant para evitar cruzar datos
// entre dominios.
import { db } from './firestore.js';
export function normalize(str) {
    return (str ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}
export function findMatchingLocal(locales, company) {
    if (!company || !company.location || locales.length === 0)
        return null;
    const companyNorm = normalize(`${company.name ?? ''} ${company.location}`);
    const locationNorm = normalize(company.location);
    const exact = locales.find((l) => normalize(l.local_descripcion) === companyNorm);
    if (exact)
        return exact;
    const locWord = new RegExp(`(^|\\s)${locationNorm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}($|\\s)`);
    const locMatch = locales.find((l) => locWord.test(normalize(l.local_descripcion)));
    if (locMatch)
        return locMatch;
    return null;
}
// Itera companies del tenant dado y resuelve qué localIds le tocan dentro
// del dominio POS de ese tenant. Companies sin match explícito pero con un
// único local disponible en el dominio → asignan ese local (útil para
// tenants single-location como Filipo). Si hay varios locales sin match,
// se omiten: el cliente no debe adivinar.
export async function buildCompanyLocalMap(tenantId, locales) {
    const snap = await db.collection('companies').where('posTenantId', '==', tenantId).get();
    const entries = [];
    for (const doc of snap.docs) {
        const company = doc.data();
        const matched = findMatchingLocal(locales, company);
        if (matched) {
            entries.push({
                companyId: doc.id,
                localIds: [Number(matched.local_id)],
                matchedExact: true,
            });
            continue;
        }
        // Fallback tenant-single-local: si el dominio tiene un solo local, se
        // asigna automáticamente. Evita que tenants de un solo local queden
        // sin sincronizar por un nombre de local que no coincide con la
        // `location` de la company.
        if (locales.length === 1) {
            entries.push({
                companyId: doc.id,
                localIds: [Number(locales[0].local_id)],
                matchedExact: false,
            });
        }
    }
    return entries;
}
//# sourceMappingURL=pos-company-mapping.js.map