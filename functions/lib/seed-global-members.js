// Trigger Firestore: cuando se crea una compañía nueva, le siembra las
// membresías de los "miembros globales" — usuarios que por definición deben
// tener acceso a TODAS las compañías del grupo (ej. contabilidad@, que lleva la
// tesorería de todos los locales en Ecore).
//
// Sin esto, cada compañía nueva exige acordarse de invitar al contador a mano
// desde Ajustes → Equipo: el filtro de company-provider exige un doc en
// `companies/{id}/members/{uid}` para que la compañía sea siquiera visible.
//
// Fuente de verdad: colección raíz `globalMembers/{uid}` con
// `{ userId, email, displayName, role }`. Las reglas de Firestore la deniegan
// al cliente (deny by default); sólo se administra con el Admin SDK.
//
// El doc del rol se copia desde otra compañía que ya lo tenga, para no duplicar
// aquí la definición de permisos que vive en el front (`DEFAULT_ROLES`).
//
// BUG firebase-functions v2 (ver cabecera de sheet-jobs-trigger.ts): con el
// trigger desplegado por gcloud, `event.data`/`event.params` pueden llegar sin
// decodificar. Mismo fallback: sacamos la ruta del documento del buffer crudo.
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firestore.js';
// Extrae el companyId del evento crudo cuando firebase-functions no lo decodificó.
function extractCompanyId(event) {
    const ev = event;
    const idx = [];
    for (const k of Object.keys(ev)) {
        if (/^\d+$/.test(k))
            idx.push(Number(k));
    }
    if (idx.length === 0)
        return null;
    idx.sort((a, b) => a - b);
    const bytes = Buffer.from(idx.map((i) => Number(ev[i]) & 0xff));
    const s = bytes.toString('latin1');
    const m = /documents\/companies\/([A-Za-z0-9_-]+)/.exec(s);
    return m ? m[1] : null;
}
// Busca la definición de un rol en cualquier otra compañía que ya lo tenga.
async function findRoleDefinition(roleId, excludeCompanyId) {
    const companies = await db.collection('companies').get();
    for (const c of companies.docs) {
        if (c.id === excludeCompanyId)
            continue;
        const snap = await db.doc(`companies/${c.id}/roles/${roleId}`).get();
        if (snap.exists)
            return snap.data();
    }
    return null;
}
export const seedGlobalMembersOnCompanyCreate = onDocumentCreated({
    document: 'companies/{companyId}',
    region: 'us-central1',
    // 256 MiB (default) hace OOM en cold start cargando firebase-admin.
    // OJO: gcloud IGNORA este valor, hay que pasar `--memory=512Mi` al deployar.
    memory: '512MiB',
}, async (event) => {
    const companyId = event.params?.companyId ?? extractCompanyId(event);
    if (!companyId) {
        console.warn('[seedGlobalMembers] evento no decodificado y sin companyId extraíble');
        return;
    }
    const globals = await db.collection('globalMembers').get();
    if (globals.empty) {
        console.log(`[seedGlobalMembers] ${companyId}: no hay miembros globales configurados`);
        return;
    }
    for (const g of globals.docs) {
        const data = g.data();
        const uid = data.userId ?? g.id;
        const roleId = data.role ?? 'viewer';
        // 1. Asegurar que el doc del rol exista en la compañía nueva: sin él,
        //    company-provider no puede resolver `allowedCompanyIds` y usePermissions
        //    no encuentra el rol del miembro.
        const roleRef = db.doc(`companies/${companyId}/roles/${roleId}`);
        if (!(await roleRef.get()).exists) {
            const definition = await findRoleDefinition(roleId, companyId);
            if (definition) {
                await roleRef.set(definition);
            }
            else {
                console.warn(`[seedGlobalMembers] ${companyId}: no se encontró definición del rol '${roleId}' en ninguna compañía`);
            }
        }
        // 2. Membresía. merge:true para no pisar un miembro ya existente
        //    (ej. si la compañía se creó y el owner alcanzó a invitarlo antes).
        await db.doc(`companies/${companyId}/members/${uid}`).set({
            userId: uid,
            email: data.email ?? '',
            displayName: data.displayName ?? '',
            role: roleId,
            status: 'active',
            invitedAt: FieldValue.serverTimestamp(),
            joinedAt: FieldValue.serverTimestamp(),
            seededAsGlobalMember: true,
        }, { merge: true });
        console.log(`[seedGlobalMembers] ${companyId} → ${data.email ?? uid} como '${roleId}'`);
    }
});
//# sourceMappingURL=seed-global-members.js.map