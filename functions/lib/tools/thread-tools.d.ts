import { z } from 'zod';
export declare function createThreadTools(companyId: string, threadId: string | undefined): {
    updateThreadState: import("ai").Tool<z.ZodObject<{
        contextPatch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        nextActionsAddOrRemove: z.ZodOptional<z.ZodObject<{
            add: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            remove: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            add?: string[] | undefined;
            remove?: string[] | undefined;
        }, {
            add?: string[] | undefined;
            remove?: string[] | undefined;
        }>>;
        summary: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["in_progress", "done", "blocked"]>>;
    }, "strip", z.ZodTypeAny, {
        status?: "done" | "in_progress" | "blocked" | undefined;
        summary?: string | undefined;
        contextPatch?: Record<string, unknown> | undefined;
        nextActionsAddOrRemove?: {
            add?: string[] | undefined;
            remove?: string[] | undefined;
        } | undefined;
    }, {
        status?: "done" | "in_progress" | "blocked" | undefined;
        summary?: string | undefined;
        contextPatch?: Record<string, unknown> | undefined;
        nextActionsAddOrRemove?: {
            add?: string[] | undefined;
            remove?: string[] | undefined;
        } | undefined;
    }>, {
        skipped: boolean;
        reason: string;
        ok?: undefined;
        threadId?: undefined;
        appliedContextKeys?: undefined;
        nextActions?: undefined;
        status?: undefined;
        summary?: undefined;
    } | {
        ok: boolean;
        threadId: string;
        appliedContextKeys: string[];
        nextActions: string[] | null;
        status: "done" | "in_progress" | "blocked" | null;
        summary: string | null;
        skipped?: undefined;
        reason?: undefined;
    }> & {
        execute: (args: {
            status?: "done" | "in_progress" | "blocked" | undefined;
            summary?: string | undefined;
            contextPatch?: Record<string, unknown> | undefined;
            nextActionsAddOrRemove?: {
                add?: string[] | undefined;
                remove?: string[] | undefined;
            } | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            skipped: boolean;
            reason: string;
            ok?: undefined;
            threadId?: undefined;
            appliedContextKeys?: undefined;
            nextActions?: undefined;
            status?: undefined;
            summary?: undefined;
        } | {
            ok: boolean;
            threadId: string;
            appliedContextKeys: string[];
            nextActions: string[] | null;
            status: "done" | "in_progress" | "blocked" | null;
            summary: string | null;
            skipped?: undefined;
            reason?: undefined;
        }>;
    };
};
//# sourceMappingURL=thread-tools.d.ts.map