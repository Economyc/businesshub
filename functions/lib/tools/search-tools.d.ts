import { z } from 'zod';
export declare function createSearchTools(companyId: string): {
    searchAll: import("ai").Tool<z.ZodObject<{
        query: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        query: string;
    }, {
        query: string;
    }>, {
        query: string;
        totalResults: number;
        employees: {
            count: number;
            results: {
                id: unknown;
                name: unknown;
                role: unknown;
                department: unknown;
                email: unknown;
                status: unknown;
            }[];
        };
        suppliers: {
            count: number;
            results: {
                id: unknown;
                name: unknown;
                category: unknown;
                contactName: unknown;
                status: unknown;
            }[];
        };
        transactions: {
            count: number;
            results: {
                id: unknown;
                concept: unknown;
                category: unknown;
                amount: unknown;
                type: unknown;
                date: string | null;
                status: unknown;
            }[];
        };
        contracts: {
            count: number;
            results: {
                id: unknown;
                title: unknown;
                employeeName: unknown;
                templateName: unknown;
                startDate: string | null;
                endDate: string | null;
            }[];
        };
    }> & {
        execute: (args: {
            query: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            query: string;
            totalResults: number;
            employees: {
                count: number;
                results: {
                    id: unknown;
                    name: unknown;
                    role: unknown;
                    department: unknown;
                    email: unknown;
                    status: unknown;
                }[];
            };
            suppliers: {
                count: number;
                results: {
                    id: unknown;
                    name: unknown;
                    category: unknown;
                    contactName: unknown;
                    status: unknown;
                }[];
            };
            transactions: {
                count: number;
                results: {
                    id: unknown;
                    concept: unknown;
                    category: unknown;
                    amount: unknown;
                    type: unknown;
                    date: string | null;
                    status: unknown;
                }[];
            };
            contracts: {
                count: number;
                results: {
                    id: unknown;
                    title: unknown;
                    employeeName: unknown;
                    templateName: unknown;
                    startDate: string | null;
                    endDate: string | null;
                }[];
            };
        }>;
    };
};
//# sourceMappingURL=search-tools.d.ts.map