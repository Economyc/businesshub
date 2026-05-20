import type { Timestamp } from 'firebase-admin/firestore';
export interface AdminTx {
    id: string;
    concept?: string;
    category?: string;
    amount?: number;
    status: 'paid' | 'pending' | 'overdue';
    date?: Timestamp;
    paidDate?: Timestamp;
    notes?: string;
    payeeRef?: {
        type: 'partner' | 'employee' | 'supplier' | 'external';
        id: string;
        name?: string;
    };
    documentKind?: 'invoice' | 'purchase';
    docNumber?: string;
    priority?: 'immediate' | 'waiting';
}
export interface FieldDef {
    key: string;
    header: string;
    type: 'string' | 'number';
}
export interface AccountingRow {
    [key: string]: string | number;
    numeracion: string;
    fecha: string;
    nit: string;
    proveedor: string;
    concepto: string;
    categoria: string;
    prioridad: string;
    tipo: string;
    numero: string;
    valor: number;
    estado: string;
    metodoPago: string;
    notas: string;
}
export declare const ACCOUNTING_FIELDS: FieldDef[];
export declare function buildAccountingRows(txs: AdminTx[], suppliersById: Map<string, string>, startIndex?: number): AccountingRow[];
//# sourceMappingURL=accounting-rows.d.ts.map