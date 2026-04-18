import { z } from 'zod';
export declare function createNotificationsTools(companyId: string): {
    getNotifications: import("ai").Tool<z.ZodObject<{
        onlyUnread: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        type: z.ZodOptional<z.ZodEnum<["weekly-report", "overdue-alert", "closing-reminder", "price-increase"]>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        onlyUnread: boolean;
        limit: number;
        type?: "weekly-report" | "overdue-alert" | "closing-reminder" | "price-increase" | undefined;
    }, {
        type?: "weekly-report" | "overdue-alert" | "closing-reminder" | "price-increase" | undefined;
        onlyUnread?: boolean | undefined;
        limit?: number | undefined;
    }>, {
        totalCount: number;
        unreadCount: number;
        returnedCount: number;
        notifications: {
            id: unknown;
            type: unknown;
            title: unknown;
            summary: unknown;
            read: unknown;
            createdAt: string | null;
        }[];
    }> & {
        execute: (args: {
            onlyUnread: boolean;
            limit: number;
            type?: "weekly-report" | "overdue-alert" | "closing-reminder" | "price-increase" | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            totalCount: number;
            unreadCount: number;
            returnedCount: number;
            notifications: {
                id: unknown;
                type: unknown;
                title: unknown;
                summary: unknown;
                read: unknown;
                createdAt: string | null;
            }[];
        }>;
    };
    markNotificationsRead: import("ai").Tool<z.ZodObject<{
        ids: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        ids: string[];
    }, {
        ids: string[];
    }>, unknown> & {
        execute: undefined;
    };
    createNotification: import("ai").Tool<z.ZodObject<{
        type: z.ZodEnum<["weekly-report", "overdue-alert", "closing-reminder", "price-increase"]>;
        title: z.ZodString;
        summary: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "weekly-report" | "overdue-alert" | "closing-reminder" | "price-increase";
        title: string;
        summary: string;
    }, {
        type: "weekly-report" | "overdue-alert" | "closing-reminder" | "price-increase";
        title: string;
        summary: string;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=notifications-tools.d.ts.map