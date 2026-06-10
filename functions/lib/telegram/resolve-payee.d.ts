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