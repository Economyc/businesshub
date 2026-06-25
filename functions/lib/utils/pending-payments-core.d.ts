import { type PendingReport, type PendingCompany } from './build-pending-payments-pdf.js';
export declare const PENDING_STATUSES: string[];
export declare function bogotaLabel(date: Date): string;
/** Construye la sección de una compañía. Devuelve null si no tiene nada pendiente. */
export declare function buildCompanySection(companyId: string, companyName: string): Promise<PendingCompany | null>;
export declare function buildCaption(report: PendingReport): string;
//# sourceMappingURL=pending-payments-core.d.ts.map