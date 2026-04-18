import type { PosLocalRaw } from './pos-client.js';
interface CompanyLike {
    name?: string | null;
    location?: string | null;
}
export declare function normalize(str: string | null | undefined): string;
export declare function findMatchingLocal(locales: PosLocalRaw[], company: CompanyLike | null | undefined): PosLocalRaw | null;
export interface CompanyLocalMapEntry {
    companyId: string;
    localIds: number[];
    matchedExact: boolean;
}
export declare function buildCompanyLocalMap(locales: PosLocalRaw[]): Promise<CompanyLocalMapEntry[]>;
export {};
//# sourceMappingURL=pos-company-mapping.d.ts.map