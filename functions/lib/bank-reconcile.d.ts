interface ReconcileInput {
    companyId: string;
    /** Si se omite, se usa el statement importado más reciente sin conciliar. */
    statementId?: string;
    toolCallId?: string;
}
export declare const reconcileBankStatement: import("firebase-functions/v2/https").CallableFunction<ReconcileInput, any, unknown>;
export {};
//# sourceMappingURL=bank-reconcile.d.ts.map