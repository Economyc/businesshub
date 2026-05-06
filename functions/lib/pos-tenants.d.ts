export type TenantId = 'blue' | 'filipo';
export declare const TENANT_SECRETS: string[];
export declare function getTenantDomainId(tenantId: TenantId): string;
export declare function getTenantToken(tenantId: TenantId): string;
export declare function listTenantIds(): TenantId[];
export declare function resolveCompanyTenant(companyId: string): Promise<TenantId>;
export declare function groupCompaniesByTenant(): Promise<Map<TenantId, string[]>>;
//# sourceMappingURL=pos-tenants.d.ts.map