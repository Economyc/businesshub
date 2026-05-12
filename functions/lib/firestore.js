import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
if (getApps().length === 0) {
    initializeApp();
}
export const db = getFirestore();
// Colecciones en la raíz de Firestore (compartidas entre todas las companies),
// no bajo `companies/{companyId}/`. Espejo de `ROOT_COLLECTIONS` del front
// (`src/core/firebase/helpers.ts`). `suppliers`: catálogo de proveedores único.
const ROOT_COLLECTIONS = new Set(['suppliers']);
function collectionRef(companyId, collectionName) {
    if (ROOT_COLLECTIONS.has(collectionName)) {
        return db.collection(collectionName);
    }
    return db.collection('companies').doc(companyId).collection(collectionName);
}
export async function fetchCollection(companyId, collectionName) {
    const snapshot = await collectionRef(companyId, collectionName).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
export async function fetchDocument(companyId, collectionName, docId) {
    const doc = await collectionRef(companyId, collectionName).doc(docId).get();
    if (!doc.exists)
        return null;
    return { id: doc.id, ...doc.data() };
}
export async function fetchSettingsDoc(companyId, settingsName) {
    const doc = await db
        .collection('companies')
        .doc(companyId)
        .collection('settings')
        .doc(settingsName)
        .get();
    if (!doc.exists)
        return null;
    return doc.data();
}
export async function createDocumentInCollection(companyId, collectionName, data) {
    const ref = await collectionRef(companyId, collectionName)
        .add({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return ref.id;
}
export async function updateDocumentInCollection(companyId, collectionName, docId, data) {
    await collectionRef(companyId, collectionName)
        .doc(docId)
        .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}
//# sourceMappingURL=firestore.js.map