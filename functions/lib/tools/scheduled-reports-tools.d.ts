import { z } from 'zod';
export declare function createScheduledReportsTools(companyId: string): {
    listScheduledReports: import("ai").Tool<z.ZodObject<{
        enabledOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        enabledOnly: boolean;
    }, {
        enabledOnly?: boolean | undefined;
    }>, {
        totalCount: number;
        enabledCount: number;
        returnedCount: number;
        reports: {
            id: unknown;
            name: unknown;
            reportType: unknown;
            period: unknown;
            dayOfWeek: {} | null;
            dayOfMonth: {} | null;
            hour: unknown;
            channel: unknown;
            recipient: unknown;
            enabled: boolean;
            lastSentAt: string | null;
        }[];
    }> & {
        execute: (args: {
            enabledOnly: boolean;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            totalCount: number;
            enabledCount: number;
            returnedCount: number;
            reports: {
                id: unknown;
                name: unknown;
                reportType: unknown;
                period: unknown;
                dayOfWeek: {} | null;
                dayOfMonth: {} | null;
                hour: unknown;
                channel: unknown;
                recipient: unknown;
                enabled: boolean;
                lastSentAt: string | null;
            }[];
        }>;
    };
    createScheduledReport: import("ai").Tool<z.ZodObject<{
        name: z.ZodString;
        reportType: z.ZodEnum<["pnl", "cashflow", "sales", "expenses", "executive"]>;
        period: z.ZodEnum<["daily", "weekly", "monthly"]>;
        dayOfWeek: z.ZodOptional<z.ZodNumber>;
        dayOfMonth: z.ZodOptional<z.ZodNumber>;
        hour: z.ZodNumber;
        channel: z.ZodEnum<["email", "whatsapp", "firestore"]>;
        recipient: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        period: "daily" | "weekly" | "monthly";
        reportType: "pnl" | "cashflow" | "sales" | "expenses" | "executive";
        hour: number;
        channel: "email" | "whatsapp" | "firestore";
        recipient: string;
        dayOfWeek?: number | undefined;
        dayOfMonth?: number | undefined;
    }, {
        name: string;
        period: "daily" | "weekly" | "monthly";
        reportType: "pnl" | "cashflow" | "sales" | "expenses" | "executive";
        hour: number;
        channel: "email" | "whatsapp" | "firestore";
        recipient: string;
        dayOfWeek?: number | undefined;
        dayOfMonth?: number | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    toggleScheduledReport: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
        enabled: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        enabled: boolean;
    }, {
        id: string;
        enabled: boolean;
    }>, unknown> & {
        execute: undefined;
    };
    deleteScheduledReport: import("ai").Tool<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=scheduled-reports-tools.d.ts.map