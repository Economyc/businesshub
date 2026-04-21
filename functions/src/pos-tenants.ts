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

import { defineSecret } from 'firebase-functions/params'
import { db } from './firestore.js'

export type TenantId = 'blue' | 'filipo'

interface TenantConfig {
  domainId: string
  secretName: string
  // Objeto SecretParam para `.value()` en runtime; tipo inferido por TS.
  secret: ReturnType<typeof defineSecret>
}

// Secret actual `POS_TOKEN` = token del grupo Blue (dominio 8267). Mantenemos
// el nombre original para no tener que rotar la credencial existente.
const POS_TOKEN_BLUE = defineSecret('POS_TOKEN')
const POS_TOKEN_FILIPO = defineSecret('POS_TOKEN_FILIPO')

const TENANT_CONFIG: Record<TenantId, TenantConfig> = {
  blue: { domainId: '8267', secretName: 'POS_TOKEN', secret: POS_TOKEN_BLUE },
  filipo: { domainId: '7052', secretName: 'POS_TOKEN_FILIPO', secret: POS_TOKEN_FILIPO },
}

// Lista de nombres de secrets para pasar a `secrets: [...]` en los options de
// las functions. `secrets` acepta strings además de SecretParam, así evitamos
// exponer el tipo interno (que TS no puede portabilizar en los .d.ts emitidos).
// Todas las functions que toquen POS deben declarar ambos nombres porque no
// sabemos qué tenant va a venir hasta runtime.
export const TENANT_SECRETS: string[] = Object.values(TENANT_CONFIG).map(
  (c) => c.secretName,
)

export function getTenantDomainId(tenantId: TenantId): string {
  return TENANT_CONFIG[tenantId].domainId
}

export function getTenantToken(tenantId: TenantId): string {
  return TENANT_CONFIG[tenantId].secret.value()
}

export function listTenantIds(): TenantId[] {
  return Object.keys(TENANT_CONFIG) as TenantId[]
}

function isTenantId(value: unknown): value is TenantId {
  return typeof value === 'string' && value in TENANT_CONFIG
}

// Resuelve el tenant de una company. Falla ruidosamente si el campo no existe
// o es desconocido — un error acá es recuperable (añadir el campo), pero
// sincronizar con el POS equivocado produce data corrupta silenciosamente.
export async function resolveCompanyTenant(companyId: string): Promise<TenantId> {
  const snap = await db.collection('companies').doc(companyId).get()
  if (!snap.exists) {
    throw new Error(`Company ${companyId} no existe en Firestore`)
  }
  const data = snap.data() ?? {}
  const raw = (data as { posTenantId?: unknown }).posTenantId
  if (!isTenantId(raw)) {
    throw new Error(
      `Company ${companyId} no tiene posTenantId válido ` +
        `(valor=${JSON.stringify(raw)}). Tenants válidos: ${listTenantIds().join(', ')}`,
    )
  }
  return raw
}

// Agrupa todas las companies por tenant. Companies sin posTenantId se
// omiten con un warning — útil para el cron nocturno, que no debe
// bloquearse por una sola company mal configurada.
export async function groupCompaniesByTenant(): Promise<Map<TenantId, string[]>> {
  const snap = await db.collection('companies').get()
  const groups = new Map<TenantId, string[]>()
  for (const tid of listTenantIds()) groups.set(tid, [])
  for (const doc of snap.docs) {
    const raw = (doc.data() as { posTenantId?: unknown }).posTenantId
    if (!isTenantId(raw)) {
      console.warn(
        `[PosTenants] company=${doc.id} sin posTenantId válido (valor=${JSON.stringify(raw)}), omitida`,
      )
      continue
    }
    groups.get(raw)!.push(doc.id)
  }
  return groups
}
