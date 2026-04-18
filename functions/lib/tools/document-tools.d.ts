import { z } from 'zod';
export declare function createDocumentTools(companyId: string): {
    getContracts: import("ai").Tool<z.ZodObject<{
        employeeName: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status?: string | undefined;
        employeeName?: string | undefined;
    }, {
        status?: string | undefined;
        employeeName?: string | undefined;
    }>, {
        count: number;
        contracts: {
            id: unknown;
            title: unknown;
            employeeName: unknown;
            employeeId: unknown;
            templateName: unknown;
            status: unknown;
            startDate: unknown;
            endDate: unknown;
            createdAt: string | null;
            salary: unknown;
            position: unknown;
            department: unknown;
        }[];
    }> & {
        execute: (args: {
            status?: string | undefined;
            employeeName?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            contracts: {
                id: unknown;
                title: unknown;
                employeeName: unknown;
                employeeId: unknown;
                templateName: unknown;
                status: unknown;
                startDate: unknown;
                endDate: unknown;
                createdAt: string | null;
                salary: unknown;
                position: unknown;
                department: unknown;
            }[];
        }>;
    };
    getContractTemplates: import("ai").Tool<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>, {
        count: number;
        templates: {
            id: unknown;
            name: unknown;
            description: unknown;
            clauseCount: number;
        }[];
    }> & {
        execute: (args: {}, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            templates: {
                id: unknown;
                name: unknown;
                description: unknown;
                clauseCount: number;
            }[];
        }>;
    };
    getExpiringContracts: import("ai").Tool<z.ZodObject<{
        days: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        days: number;
    }, {
        days?: number | undefined;
    }>, {
        expiringCount: number;
        expiredCount: number;
        expiring: {
            id: unknown;
            title: unknown;
            employeeName: unknown;
            employeeId: unknown;
            templateName: unknown;
            status: unknown;
            startDate: unknown;
            endDate: unknown;
            createdAt: string | null;
            salary: unknown;
            position: unknown;
            department: unknown;
        }[];
        expired: {
            id: unknown;
            title: unknown;
            employeeName: unknown;
            employeeId: unknown;
            templateName: unknown;
            status: unknown;
            startDate: unknown;
            endDate: unknown;
            createdAt: string | null;
            salary: unknown;
            position: unknown;
            department: unknown;
        }[];
        searchDays: number;
    }> & {
        execute: (args: {
            days: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            expiringCount: number;
            expiredCount: number;
            expiring: {
                id: unknown;
                title: unknown;
                employeeName: unknown;
                employeeId: unknown;
                templateName: unknown;
                status: unknown;
                startDate: unknown;
                endDate: unknown;
                createdAt: string | null;
                salary: unknown;
                position: unknown;
                department: unknown;
            }[];
            expired: {
                id: unknown;
                title: unknown;
                employeeName: unknown;
                employeeId: unknown;
                templateName: unknown;
                status: unknown;
                startDate: unknown;
                endDate: unknown;
                createdAt: string | null;
                salary: unknown;
                position: unknown;
                department: unknown;
            }[];
            searchDays: number;
        }>;
    };
    createContractTemplate: import("ai").Tool<z.ZodObject<{
        name: z.ZodString;
        contractType: z.ZodEnum<["indefinido", "fijo", "obra_labor", "aprendizaje", "prestacion_servicios"]>;
        position: z.ZodString;
        description: z.ZodString;
        clauses: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            content: z.ZodString;
            isRequired: z.ZodBoolean;
            isEditable: z.ZodBoolean;
            order: z.ZodNumber;
            category: z.ZodEnum<["mandatory", "optional", "position_specific"]>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            category: "mandatory" | "optional" | "position_specific";
            title: string;
            content: string;
            isRequired: boolean;
            isEditable: boolean;
            order: number;
        }, {
            id: string;
            category: "mandatory" | "optional" | "position_specific";
            title: string;
            content: string;
            isRequired: boolean;
            isEditable: boolean;
            order: number;
        }>, "many">;
        isDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        name: string;
        position: string;
        clauses: {
            id: string;
            category: "mandatory" | "optional" | "position_specific";
            title: string;
            content: string;
            isRequired: boolean;
            isEditable: boolean;
            order: number;
        }[];
        contractType: "indefinido" | "fijo" | "obra_labor" | "aprendizaje" | "prestacion_servicios";
        isDefault: boolean;
    }, {
        description: string;
        name: string;
        position: string;
        clauses: {
            id: string;
            category: "mandatory" | "optional" | "position_specific";
            title: string;
            content: string;
            isRequired: boolean;
            isEditable: boolean;
            order: number;
        }[];
        contractType: "indefinido" | "fijo" | "obra_labor" | "aprendizaje" | "prestacion_servicios";
        isDefault?: boolean | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    updateContractTemplate: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        position: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        isDefault: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        description?: string | undefined;
        name?: string | undefined;
        position?: string | undefined;
        isDefault?: boolean | undefined;
    }, {
        id: string;
        description?: string | undefined;
        name?: string | undefined;
        position?: string | undefined;
        isDefault?: boolean | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    deleteContractTemplate: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>, unknown> & {
        execute: undefined;
    };
    createContractFromTemplate: import("ai").Tool<z.ZodObject<{
        templateId: z.ZodString;
        employeeId: z.ZodOptional<z.ZodString>;
        employeeName: z.ZodString;
        employeeIdentification: z.ZodString;
        position: z.ZodString;
        salary: z.ZodNumber;
        startDate: z.ZodString;
        endDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        salary: number;
        startDate: string;
        employeeName: string;
        position: string;
        templateId: string;
        employeeIdentification: string;
        endDate?: string | undefined;
        employeeId?: string | undefined;
    }, {
        salary: number;
        startDate: string;
        employeeName: string;
        position: string;
        templateId: string;
        employeeIdentification: string;
        endDate?: string | undefined;
        employeeId?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=document-tools.d.ts.map