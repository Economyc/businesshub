import { z } from 'zod';
export declare function createMarketingTools(companyId: string): {
    getInfluencerVisits: import("ai").Tool<z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<["pending", "completed"]>>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        startDate?: string | undefined;
        status?: "pending" | "completed" | undefined;
        endDate?: string | undefined;
    }, {
        startDate?: string | undefined;
        status?: "pending" | "completed" | undefined;
        endDate?: string | undefined;
    }>, {
        count: number;
        pending: number;
        completed: number;
        visits: {
            id: unknown;
            name: unknown;
            socialNetworks: unknown;
            visitDate: string | null;
            content: unknown;
            status: unknown;
            order: unknown;
            notes: unknown;
        }[];
    }> & {
        execute: (args: {
            startDate?: string | undefined;
            status?: "pending" | "completed" | undefined;
            endDate?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            pending: number;
            completed: number;
            visits: {
                id: unknown;
                name: unknown;
                socialNetworks: unknown;
                visitDate: string | null;
                content: unknown;
                status: unknown;
                order: unknown;
                notes: unknown;
            }[];
        }>;
    };
    getInfluencerContentReport: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        dateRange: {
            startDate: string;
            endDate: string;
        };
        visitsCount: number;
        stories: number;
        posts: number;
        reels: number;
        totalContent: number;
        topInfluencers: {
            visits: number;
            content: number;
            name: string;
        }[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            dateRange: {
                startDate: string;
                endDate: string;
            };
            visitsCount: number;
            stories: number;
            posts: number;
            reels: number;
            totalContent: number;
            topInfluencers: {
                visits: number;
                content: number;
                name: string;
            }[];
        }>;
    };
    createInfluencerVisit: import("ai").Tool<z.ZodObject<{
        name: z.ZodString;
        socialNetworks: z.ZodArray<z.ZodObject<{
            platform: z.ZodEnum<["instagram", "tiktok", "youtube", "facebook", "twitter", "other"]>;
            handle: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            platform: "instagram" | "tiktok" | "youtube" | "facebook" | "twitter" | "other";
            handle: string;
        }, {
            platform: "instagram" | "tiktok" | "youtube" | "facebook" | "twitter" | "other";
            handle: string;
        }>, "many">;
        visitDate: z.ZodString;
        content: z.ZodObject<{
            story: z.ZodBoolean;
            post: z.ZodBoolean;
            reel: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            story: boolean;
            post: boolean;
            reel: boolean;
        }, {
            story: boolean;
            post: boolean;
            reel: boolean;
        }>;
        notes: z.ZodOptional<z.ZodString>;
        status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["pending", "completed"]>>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        status: "pending" | "completed";
        content: {
            story: boolean;
            post: boolean;
            reel: boolean;
        };
        socialNetworks: {
            platform: "instagram" | "tiktok" | "youtube" | "facebook" | "twitter" | "other";
            handle: string;
        }[];
        visitDate: string;
        notes?: string | undefined;
    }, {
        name: string;
        content: {
            story: boolean;
            post: boolean;
            reel: boolean;
        };
        socialNetworks: {
            platform: "instagram" | "tiktok" | "youtube" | "facebook" | "twitter" | "other";
            handle: string;
        }[];
        visitDate: string;
        status?: "pending" | "completed" | undefined;
        notes?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=marketing-tools.d.ts.map