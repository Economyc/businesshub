export type PayeeType = 'partner' | 'employee' | 'supplier' | 'external';
export interface PayeeRef {
    type: PayeeType;
    id: string;
    name: string;
}
export interface CompanyInfo {
    id: string;
    name: string;
    location?: string | null;
    slug?: string | null;
}
export type PayeeResolution = {
    ok: true;
    payee: PayeeRef;
    supplierCategory?: string;
} | {
    ok: false;
    reason: 'not_found';
    type: PayeeType;
    name: string;
} | {
    ok: false;
    reason: 'ambiguous';
    matches: Array<{
        id: string;
        name: string;
    }>;
};
/**
 * Puntaje de similitud entre el proveedor extraído del documento y un
 * proveedor registrado. Misma lógica/umbral que la web (analyze-invoice-document.ts):
 * exact=1.0, inclusión=0.85, tokens compartidos (>2 chars) / max. Rango [0,1].
 */
export declare function similarSupplier(extractedName: string, supplierName: string): number;
export declare function resolvePayeeOnCompany(companyId: string, type: PayeeType, name: string): Promise<PayeeResolution>;
export type CompanyResolution = {
    ok: true;
    company: CompanyInfo;
} | {
    ok: false;
    reason: 'not_found';
} | {
    ok: false;
    reason: 'ambiguous';
    matches: CompanyInfo[];
};
export declare function resolveCompany(input: string, companies: CompanyInfo[]): CompanyResolution;
//# sourceMappingURL=resolve-payee.d.ts.map