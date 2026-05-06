import { z } from 'zod';
export declare function createAnomalyTools(companyId: string): {
    getDetectedAnomalies: import("ai").Tool<z.ZodObject<{
        severity: z.ZodOptional<z.ZodEnum<["info", "warning"]>>;
        since: z.ZodOptional<z.ZodString>;
        includeAcknowledged: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        includeAcknowledged: boolean;
        severity?: "warning" | "info" | undefined;
        since?: string | undefined;
    }, {
        limit?: number | undefined;
        severity?: "warning" | "info" | undefined;
        since?: string | undefined;
        includeAcknowledged?: boolean | undefined;
    }>, {
        totalCount: number;
        unacknowledgedCount: number;
        returnedCount: number;
        anomalies: {
            id: unknown;
            severity: {};
            title: unknown;
            description: {};
            evidence: {};
            acknowledged: boolean;
            createdAt: string | null;
        }[];
    }> & {
        execute: (args: {
            limit: number;
            includeAcknowledged: boolean;
            severity?: "warning" | "info" | undefined;
            since?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            totalCount: number;
            unacknowledgedCount: number;
            returnedCount: number;
            anomalies: {
                id: unknown;
                severity: {};
                title: unknown;
                description: {};
                evidence: {};
                acknowledged: boolean;
                createdAt: string | null;
            }[];
        }>;
    };
    acknowledgeAnomaly: import("ai").Tool<z.ZodObject<{
        notificationId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        notificationId: string;
    }, {
        notificationId: string;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=anomaly-tools.d.ts.map