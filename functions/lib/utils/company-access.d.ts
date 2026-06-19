/**
 * Verifica que el usuario sea miembro activo de la empresa. Compartido por los
 * callables que escriben documentos de la empresa en Drive. El owner de la
 * plataforma bypasea el check (alineado con el cliente).
 */
export declare function assertCompanyMember(uid: string, companyId: string): Promise<void>;
//# sourceMappingURL=company-access.d.ts.map