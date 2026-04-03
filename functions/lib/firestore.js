import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (getApps().length === 0) {
    initializeApp();
}
export const db = getFirestore();
export async function fetchCollection(companyId, collectionName) {
    const snapshot = await db
        .collection('companies')
        .doc(companyId)
        .collection(collectionName)
        .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
export async function fetchDocument(companyId, collectionName, docId) {
    const doc = await db
        .collection('companies')
        .doc(companyId)
        .collection(collectionName)
        .doc(docId)
        .get();
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
//# sourceMappingURL=firestore.js.map