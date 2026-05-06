import { z } from 'zod';
declare const PlanStepSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    toolName: z.ZodString;
    toolArgs: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    optional: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    optional?: boolean | undefined;
}, {
    id: string;
    label: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    optional?: boolean | undefined;
}>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
export declare function createPlanModeTools(): {
    proposeMultiStepPlan: import("ai").Tool<z.ZodObject<{
        title: z.ZodString;
        rationale: z.ZodString;
        steps: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            toolName: z.ZodString;
            toolArgs: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            optional: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            toolName: string;
            toolArgs: Record<string, unknown>;
            optional?: boolean | undefined;
        }, {
            id: string;
            label: string;
            toolName: string;
            toolArgs: Record<string, unknown>;
            optional?: boolean | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        title: string;
        steps: {
            id: string;
            label: string;
            toolName: string;
            toolArgs: Record<string, unknown>;
            optional?: boolean | undefined;
        }[];
        rationale: string;
    }, {
        title: string;
        steps: {
            id: string;
            label: string;
            toolName: string;
            toolArgs: Record<string, unknown>;
            optional?: boolean | undefined;
        }[];
        rationale: string;
    }>, unknown> & {
        execute: undefined;
    };
};
export {};
//# sourceMappingURL=plan-mode-tools.d.ts.map