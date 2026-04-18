import { z } from 'zod';
export declare function createPosTools(companyId: string): {
    getPosSales: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
        localId: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
        localId?: number | undefined;
    }, {
        startDate: string;
        endDate: string;
        localId?: number | undefined;
    }>, {
        dateRange: {
            startDate: string;
            endDate: string;
        };
        localId: string | number;
        totalSales: number;
        totalRevenue: number;
        avgTicket: number;
        daysWithSales: number;
        byDay: {
            date: string;
            total: number;
            count: number;
            avgTicket: number;
        }[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
            localId?: number | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            dateRange: {
                startDate: string;
                endDate: string;
            };
            localId: string | number;
            totalSales: number;
            totalRevenue: number;
            avgTicket: number;
            daysWithSales: number;
            byDay: {
                date: string;
                total: number;
                count: number;
                avgTicket: number;
            }[];
        }>;
    };
    getSalesByPaymentMethod: import("ai").Tool<z.ZodObject<{
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
        totalRevenue: number;
        ventasCount: number;
        byPaymentMethod: {
            method: string;
            total: number;
            count: number;
            percentage: number;
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
            totalRevenue: number;
            ventasCount: number;
            byPaymentMethod: {
                method: string;
                total: number;
                count: number;
                percentage: number;
            }[];
        }>;
    };
    getTopProducts: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
        limit: number;
    }, {
        startDate: string;
        endDate: string;
        limit?: number | undefined;
    }>, {
        dateRange: {
            startDate: string;
            endDate: string;
        };
        uniqueProducts: number;
        topProducts: {
            units: number;
            revenue: number;
            category: string;
            name: string;
        }[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
            limit: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            dateRange: {
                startDate: string;
                endDate: string;
            };
            uniqueProducts: number;
            topProducts: {
                units: number;
                revenue: number;
                category: string;
                name: string;
            }[];
        }>;
    };
    getSalesByLocation: import("ai").Tool<z.ZodObject<{
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
        totalRevenue: number;
        ventasCount: number;
        byLocation: {
            localId: string;
            total: number;
            count: number;
            avgTicket: number;
            percentage: number;
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
            totalRevenue: number;
            ventasCount: number;
            byLocation: {
                localId: string;
                total: number;
                count: number;
                avgTicket: number;
                percentage: number;
            }[];
        }>;
    };
    getPosSyncStatus: import("ai").Tool<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>, {
        monthsCached: number;
        firstMonth: string;
        lastMonth: string;
        lastDateWithData: string | null;
        gapsInLast14Days: string[];
    }> & {
        execute: (args: {}, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            monthsCached: number;
            firstMonth: string;
            lastMonth: string;
            lastDateWithData: string | null;
            gapsInLast14Days: string[];
        }>;
    };
    triggerPosReconcile: import("ai").Tool<z.ZodObject<{
        days: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        days: number;
    }, {
        days?: number | undefined;
    }>, unknown> & {
        execute: undefined;
    };
};
//# sourceMappingURL=pos-tools.d.ts.map