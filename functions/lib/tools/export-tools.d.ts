import { z } from 'zod';
/**
 * Export tool — no execute function.
 * Returns structured data to the frontend which generates and downloads the file.
 */
export declare function createExportTools(): {
    exportReport: import("ai").Tool<z.ZodObject<{
        format: z.ZodEnum<["pdf", "excel"]>;
        title: z.ZodString;
        sections: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            type: z.ZodEnum<["table", "kpi", "text"]>;
            data: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            type: "table" | "kpi" | "text";
            heading: string;
            data?: unknown;
        }, {
            type: "table" | "kpi" | "text";
            heading: string;
            data?: unknown;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        title: string;
        format: "pdf" | "excel";
        sections: {
            type: "table" | "kpi" | "text";
            heading: string;
            data?: unknown;
        }[];
    }, {
        title: string;
        format: "pdf" | "excel";
        sections: {
            type: "table" | "kpi" | "text";
            heading: string;
            data?: unknown;
        }[];
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=export-tools.d.ts.map