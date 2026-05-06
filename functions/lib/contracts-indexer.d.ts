export declare function chunkText(text: string, size?: number, overlap?: number): string[];
export declare function indexContract(companyId: string, contractId: string, data: Record<string, unknown>): Promise<{
    chunks: number;
}>;
export declare const indexContractEmbeddings: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/core").Change<import("firebase-functions/v2/firestore").DocumentSnapshot> | undefined, {
    contractId: string;
    companyId: string;
}>>;
//# sourceMappingURL=contracts-indexer.d.ts.map