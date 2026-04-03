export declare const db: FirebaseFirestore.Firestore;
export declare function fetchCollection(companyId: string, collectionName: string): Promise<Record<string, unknown>[]>;
export declare function fetchDocument(companyId: string, collectionName: string, docId: string): Promise<Record<string, unknown> | null>;
export declare function fetchSettingsDoc(companyId: string, settingsName: string): Promise<Record<string, unknown> | null>;
//# sourceMappingURL=firestore.d.ts.map