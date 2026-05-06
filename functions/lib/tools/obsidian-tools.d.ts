import { z } from 'zod';
export declare function createObsidianTools(): {
    saveToObsidian: import("ai").Tool<z.ZodObject<{
        title: z.ZodString;
        content: z.ZodString;
        folder: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        frontmatter: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        content: string;
        folder?: string | undefined;
        tags?: string[] | undefined;
        frontmatter?: Record<string, unknown> | undefined;
    }, {
        title: string;
        content: string;
        folder?: string | undefined;
        tags?: string[] | undefined;
        frontmatter?: Record<string, unknown> | undefined;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=obsidian-tools.d.ts.map