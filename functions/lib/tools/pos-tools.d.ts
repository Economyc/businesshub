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
    getPosCatalog: import("ai").Tool<z.ZodObject<{
        localId: z.ZodOptional<z.ZodNumber>;
        category: z.ZodOptional<z.ZodString>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        category?: string | undefined;
        localId?: number | undefined;
    }, {
        category?: string | undefined;
        limit?: number | undefined;
        localId?: number | undefined;
    }>, {
        found: boolean;
        message: string;
        localId?: undefined;
        syncedAt?: undefined;
        totalProducts?: undefined;
        returnedProducts?: undefined;
        byCategory?: undefined;
        products?: undefined;
    } | {
        found: boolean;
        localId: string | number;
        syncedAt: string | null;
        totalProducts: number;
        returnedProducts: number;
        byCategory: Record<string, number>;
        products: {
            id: string | number | undefined;
            name: string | undefined;
            category: string | undefined;
            presentaciones: {
                id: string | number | undefined;
                name: string | undefined;
                price: number;
            }[];
            priceRange: {
                min: number;
                max: number;
            } | null;
            modifierCount: number;
        }[];
        message?: undefined;
    }> & {
        execute: (args: {
            limit: number;
            category?: string | undefined;
            localId?: number | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            found: boolean;
            message: string;
            localId?: undefined;
            syncedAt?: undefined;
            totalProducts?: undefined;
            returnedProducts?: undefined;
            byCategory?: undefined;
            products?: undefined;
        } | {
            found: boolean;
            localId: string | number;
            syncedAt: string | null;
            totalProducts: number;
            returnedProducts: number;
            byCategory: Record<string, number>;
            products: {
                id: string | number | undefined;
                name: string | undefined;
                category: string | undefined;
                presentaciones: {
                    id: string | number | undefined;
                    name: string | undefined;
                    price: number;
                }[];
                priceRange: {
                    min: number;
                    max: number;
                } | null;
                modifierCount: number;
            }[];
            message?: undefined;
        }>;
    };
    searchPosProduct: import("ai").Tool<z.ZodObject<{
        query: z.ZodString;
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        limit: number;
    }, {
        query: string;
        limit?: number | undefined;
    }>, {
        found: boolean;
        message: string;
        query?: undefined;
        matchCount?: undefined;
        returned?: undefined;
        products?: undefined;
    } | {
        query: string;
        matchCount: number;
        returned: number;
        products: {
            id: string | number | undefined;
            name: string | undefined;
            category: string | undefined;
            presentaciones: {
                id: string | number | undefined;
                name: string | undefined;
                price: number;
            }[];
            priceRange: {
                min: number;
                max: number;
            } | null;
            modifierCount: number;
        }[];
        found?: undefined;
        message?: undefined;
    }> & {
        execute: (args: {
            query: string;
            limit: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            found: boolean;
            message: string;
            query?: undefined;
            matchCount?: undefined;
            returned?: undefined;
            products?: undefined;
        } | {
            query: string;
            matchCount: number;
            returned: number;
            products: {
                id: string | number | undefined;
                name: string | undefined;
                category: string | undefined;
                presentaciones: {
                    id: string | number | undefined;
                    name: string | undefined;
                    price: number;
                }[];
                priceRange: {
                    min: number;
                    max: number;
                } | null;
                modifierCount: number;
            }[];
            found?: undefined;
            message?: undefined;
        }>;
    };
    getProductsWithoutSales: import("ai").Tool<z.ZodObject<{
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
        found: boolean;
        message: string;
        dateRange?: undefined;
        catalogSize?: undefined;
        soldUnique?: undefined;
        withoutSalesCount?: undefined;
        products?: undefined;
    } | {
        dateRange: {
            startDate: string;
            endDate: string;
        };
        catalogSize: number;
        soldUnique: number;
        withoutSalesCount: number;
        products: {
            id: string | number | undefined;
            name: string | undefined;
            category: string | undefined;
            presentaciones: {
                id: string | number | undefined;
                name: string | undefined;
                price: number;
            }[];
            priceRange: {
                min: number;
                max: number;
            } | null;
            modifierCount: number;
        }[];
        found?: undefined;
        message?: undefined;
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
            limit: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            found: boolean;
            message: string;
            dateRange?: undefined;
            catalogSize?: undefined;
            soldUnique?: undefined;
            withoutSalesCount?: undefined;
            products?: undefined;
        } | {
            dateRange: {
                startDate: string;
                endDate: string;
            };
            catalogSize: number;
            soldUnique: number;
            withoutSalesCount: number;
            products: {
                id: string | number | undefined;
                name: string | undefined;
                category: string | undefined;
                presentaciones: {
                    id: string | number | undefined;
                    name: string | undefined;
                    price: number;
                }[];
                priceRange: {
                    min: number;
                    max: number;
                } | null;
                modifierCount: number;
            }[];
            found?: undefined;
            message?: undefined;
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