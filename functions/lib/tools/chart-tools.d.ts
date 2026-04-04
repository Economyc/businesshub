import { z } from 'zod';
/**
 * Chart tool — no execute function.
 * Returns structured data to the frontend which renders it using Recharts.
 * The agent decides chart type and data based on context.
 */
export declare function createChartTools(): {
    generateChart: import("ai").Tool<z.ZodObject<{
        chartType: z.ZodEnum<["bar", "pie", "area", "line"]>;
        title: z.ZodString;
        data: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            value: z.ZodNumber;
            value2: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            value: number;
            value2?: number | undefined;
        }, {
            name: string;
            value: number;
            value2?: number | undefined;
        }>, "many">;
        valueLabel: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        value2Label: z.ZodOptional<z.ZodString>;
        formatAsCurrency: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        chartType: "bar" | "pie" | "area" | "line";
        data: {
            name: string;
            value: number;
            value2?: number | undefined;
        }[];
        valueLabel: string;
        formatAsCurrency: boolean;
        value2Label?: string | undefined;
    }, {
        title: string;
        chartType: "bar" | "pie" | "area" | "line";
        data: {
            name: string;
            value: number;
            value2?: number | undefined;
        }[];
        valueLabel?: string | undefined;
        value2Label?: string | undefined;
        formatAsCurrency?: boolean | undefined;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=chart-tools.d.ts.map