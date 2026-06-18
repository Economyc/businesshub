import type { Timestamp } from 'firebase-admin/firestore';
export interface AdminTx {
    id: string;
    concept?: string;
    category?: string;
    amount?: number;
    type?: 'income' | 'expense';
    status: 'paid' | 'pending' | 'overdue' | 'partial';
    date?: Timestamp;
    paidDate?: Timestamp;
    dueDate?: Timestamp;
    notes?: string;
    payeeRef?: {
        type: 'partner' | 'employee' | 'supplier' | 'external' | 'customer' | 'company';
        id: string;
        name?: string;
    };
    documentKind?: 'invoice' | 'purchase' | 'receivable';
    docNumber?: string;
    priority?: 'immediate' | 'waiting';
    paymentMethod?: string;
    accountId?: string;
    paidAmount?: number;
    remainingAmount?: number;
    interLocalGroupId?: string;
}
export interface AdminTransfer {
    id: string;
    fromAccountId?: string;
    toAccountId?: string;
    amount?: number;
    date?: Timestamp;
    reference?: string;
    notes?: string;
}
export interface AdminPayment {
    id: string;
    amount?: number;
    date?: Timestamp;
    accountId?: string;
    method?: string;
    notes?: string;
}
export interface AdminAccount {
    id: string;
    name?: string;
    type?: 'bank' | 'cash' | 'wallet' | 'card';
    openingBalance?: number;
}
export interface ManagedTx {
    tx: AdminTx;
    payments: AdminPayment[];
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
export declare const PAYABLE_FIELDS: FieldDef[];
export declare const RECEIVABLE_FIELDS: FieldDef[];
export declare function buildPayableRows(txs: AdminTx[], suppliersById: Map<string, string>, startIndex?: number): Record<string, string | number>[];
export declare const INTERLOCAL_FIELDS: FieldDef[];
export declare function buildInterLocalRows(txs: AdminTx[]): Record<string, string | number>[];
export declare const TRANSFER_FIELDS: FieldDef[];
export declare function buildTransferRows(transfers: AdminTransfer[], accountsById: Map<string, AdminAccount>): Record<string, string | number>[];
export declare const PAYMENT_FIELDS: FieldDef[];
export declare function buildPaymentRows(groups: ManagedTx[], accountsById: Map<string, AdminAccount>): Record<string, string | number>[];
export declare const BALANCE_FIELDS: FieldDef[];
export declare function buildBalanceRows(accounts: AdminAccount[], txs: AdminTx[], managed: ManagedTx[], transfers: AdminTransfer[]): Record<string, string | number>[];
//# sourceMappingURL=accounting-rows.d.ts.map