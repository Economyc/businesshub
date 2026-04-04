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
};
//# sourceMappingURL=document-tools.d.ts.map