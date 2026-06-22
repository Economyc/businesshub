export interface PendingInvoiceSupplier {
    supplierName: string;
    count: number;
    total: number;
    oldestDate: string | null;
    overdueCount: number;
}
export interface PendingObligation {
    concept: string;
    dueDate: string | null;
    amount: number;
    status: string;
}
export interface PendingCompany {
    companyName: string;
    invoiceSuppliers: PendingInvoiceSupplier[];
    invoiceTotal: number;
    invoiceCount: number;
    obligations: PendingObligation[];
    obligationTotal: number;
    obligationCount: number;
    companyTotal: number;
}
export interface PendingReport {
    dateLabel: string;
    companies: PendingCompany[];
    grandTotal: number;
}
export declare function buildPendingPaymentsPdf(report: PendingReport): Promise<Buffer>;
//# sourceMappingURL=build-pending-payments-pdf.d.ts.map