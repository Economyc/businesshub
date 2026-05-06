import { z } from 'zod';
export declare function createContractRagTools(companyId: string): {
    searchContracts: import("ai").Tool<z.ZodObject<{
        query: z.ZodString;
        contractId: z.ZodOptional<z.ZodString>;
        topK: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        topK: number;
        contractId?: string | undefined;
    }, {
        query: string;
        contractId?: string | undefined;
        topK?: number | undefined;
    }>, {
        count: number;
        results: never[];
        note: string;
        error?: undefined;
    } | {
        count: number;
        results: {
            contractId: string;
            contractTitle: string | null | undefined;
            chunkIndex: number;
            text: string;
            score: number;
        }[];
        note?: undefined;
        error?: undefined;
    } | {
        count: number;
        results: never[];
        error: string;
        note?: undefined;
    }> & {
        execute: (args: {
            query: string;
            topK: number;
            contractId?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            results: never[];
            note: string;
            error?: undefined;
        } | {
            count: number;
            results: {
                contractId: string;
                contractTitle: string | null | undefined;
                chunkIndex: number;
                text: string;
                score: number;
            }[];
            note?: undefined;
            error?: undefined;
        } | {
            count: number;
            results: never[];
            error: string;
            note?: undefined;
        }>;
    };
    summarizeContract: import("ai").Tool<z.ZodObject<{
        contractId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        contractId: string;
    }, {
        contractId: string;
    }>, {
        contractId: string;
        summary: null;
        note: string;
        contractTitle?: undefined;
        chunkCount?: undefined;
        error?: undefined;
    } | {
        contractId: string;
        contractTitle: string | null;
        summary: string;
        chunkCount: number;
        note?: undefined;
        error?: undefined;
    } | {
        contractId: string;
        summary: null;
        error: string;
        note?: undefined;
        contractTitle?: undefined;
        chunkCount?: undefined;
    }> & {
        execute: (args: {
            contractId: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            contractId: string;
            summary: null;
            note: string;
            contractTitle?: undefined;
            chunkCount?: undefined;
            error?: undefined;
        } | {
            contractId: string;
            contractTitle: string | null;
            summary: string;
            chunkCount: number;
            note?: undefined;
            error?: undefined;
        } | {
            contractId: string;
            summary: null;
            error: string;
            note?: undefined;
            contractTitle?: undefined;
            chunkCount?: undefined;
        }>;
    };
};
//# sourceMappingURL=contract-rag-tools.d.ts.map