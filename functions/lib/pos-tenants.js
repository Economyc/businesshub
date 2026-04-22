// Registro de tenants POS.
//
// Cada empresa conectada a restaurant.pe usa su propio token y POS_DOMAIN_ID.
// Este módulo centraliza la correspondencia tenant → { token, domainId } para
// que el resto de functions (proxy, reconcile, rebuild) no conozcan ningún
// POS hardcodeado y puedan iterar tenants o resolver uno por companyId.
//
// Routing: cada doc de `companies` lleva el campo `posTenantId`. Si un doc
// no lo tiene, el sistema FALLA RUIDOSAMENTE (ver resolveCompanyTenant) —
// preferimos error explícito antes que sincronizar datos cruzados.
//
// Agregar un tenant:
//   1. gcloud secrets create POS_TOKEN_<NAME>
//   2. Agregar entrada a TENANT_CONFIG con el nuevo defineSecret y domainId
//   3. Marcar las companies del tenant con posTenantId: '<name>' en Firestore
import { defineSecret } from 'firebase-functions/params';
import { db } from './firestore.js';
// Secret actual `POS_TOKEN` = token del grupo Blue (dominio 8267). Mantenemos
// el nombre original para no tener que rotar la credencial existente.
const POS_TOKEN_BLUE = defineSecret('POS_TOKEN');
const POS_TOKEN_FILIPO = defineSecret('POS_TOKEN_FILIPO');
const TENANT_CONFIG = {
    blue: { domainId: '8267', secretName: 'POS_TOKEN', secret: POS_TOKEN_BLUE },
    filipo: { domainId: '7052', secretName: 'POS_TOKEN_FILIPO', secret: POS_TOKEN_FILIPO },
};
// Lista de nombres de secrets para pasar a `secrets: [...]` en los options de
// las functions. `secrets` acepta strings además de SecretParam, así evitamos
// exponer el tipo interno (que TS no puede portabilizar en los .d.ts emitidos).
// Todas las functions que toquen POS deben declarar ambos nombres porque no
// sabemos qué tenant va a venir hasta runtime.
export const TENANT_SECRETS = Object.values(TENANT_CONFIG).map((c) => c.secretName);
export function getTenantDomainId(tenantId) {
    return TENANT_CONFIG[tenantId].domainId;
}
export function getTenantToken(tenantId) {
    return TENANT_CONFIG[tenantId].secret.value();
}
export function listTenantIds() {
    return Object.keys(TENANT_CONFIG);
}
function isTenantId(value) {
    return typeof value === 'string' && value in TENANT_CONFIG;
}
// Cache in-memory de `companyId → tenantId` dentro de una instancia warm de
// Cloud Function. El tenant de una company cambia muy raramente (operación
// manual), así que un TTL de 15 min es seguro y evita un `getDoc` a Firestore
// en cada request del proxy/reconcile. Después del TTL vuelve a leer —
// suficiente para que un cambio manual se refleje en < 15 min sin deploy.
//
// Clave `companyId`; valor `{ tenantId, expiresAt }`. Si la company
// desaparece (caso raro), expira naturalmente y la próxima lectura lanza
// el error esperado.
const TENANT_CACHE_TTL_MS = 15 * 60 * 1000;
const tenantCache = new Map();
// Resuelve el tenant de una company. Falla ruidosamente si el campo no existe
// o es desconocido — un error acá es recuperable (añadir el campo), pero
// sincronizar con el POS equivocado produce data corrupta silenciosamente.
export async function resolveCompanyTenant(companyId) {
    const now = Date.now();
    const cached = tenantCache.get(companyId);
    if (cached && cached.expiresAt > now) {
        return cached.tenantId;
    }
    const snap = await db.collection('companies').doc(companyId).get();
    if (!snap.exists) {
        throw new Error(`Company ${companyId} no existe en Firestore`);
    }
    const data = snap.data() ?? {};
    const raw = data.posTenantId;
    if (!isTenantId(raw)) {
        throw new Error(`Company ${companyId} no tiene posTenantId válido ` +
            `(valor=${JSON.stringify(raw)}). Tenants válidos: ${listTenantIds().join(', ')}`);
    }
    tenantCache.set(companyId, { tenantId: raw, expiresAt: now + TENANT_CACHE_TTL_MS });
    return raw;
}
// Agrupa todas las companies por tenant. Companies sin posTenantId se
// omiten con un warning — útil para el cron nocturno, que no debe
// bloquearse por una sola company mal configurada.
export async function groupCompaniesByTenant() {
    const snap = await db.collection('companies').get();
    const groups = new Map();
    for (const tid of listTenantIds())
        groups.set(tid, []);
    for (const doc of snap.docs) {
        const raw = doc.data().posTenantId;
        if (!isTenantId(raw)) {
            console.warn(`[PosTenants] company=${doc.id} sin posTenantId válido (valor=${JSON.stringify(raw)}), omitida`);
            continue;
        }
        groups.get(raw).push(doc.id);
    }
    return groups;
}
//# sourceMappingURL=pos-tenants.js.map