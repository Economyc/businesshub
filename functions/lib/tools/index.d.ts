export declare function createAgentTools(companyId: string, threadId?: string): {
    createPayableDocument: import("ai").Tool<import("zod").ZodObject<{
        documentKind: import("zod").ZodEnum<["invoice", "purchase"]>;
        supplierName: import("zod").ZodString;
        docNumber: import("zod").ZodString;
        date: import("zod").ZodString;
        amount: import("zod").ZodNumber;
        category: import("zod").ZodString;
        notes: import("zod").ZodOptional<import("zod").ZodString>;
        priority: import("zod").ZodOptional<import("zod").ZodEnum<["immediate", "waiting"]>>;
        customSupplier: import("zod").ZodOptional<import("zod").ZodBoolean>;
    }, "strip", import("zod").ZodTypeAny, {
        date: string;
        category: string;
        amount: number;
        documentKind: "invoice" | "purchase";
        docNumber: string;
        supplierName: string;
        notes?: string | undefined;
        priority?: "immediate" | "waiting" | undefined;
        customSupplier?: boolean | undefined;
    }, {
        date: string;
        category: string;
        amount: number;
        documentKind: "invoice" | "purchase";
        docNumber: string;
        supplierName: string;
        notes?: string | undefined;
        priority?: "immediate" | "waiting" | undefined;
        customSupplier?: boolean | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    findMatchingPayables: import("ai").Tool<import("zod").ZodObject<{
        supplierName: import("zod").ZodString;
        amount: import("zod").ZodNumber;
        amountTolerance: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
        amount: number;
        supplierName: string;
        amountTolerance: number;
    }, {
        amount: number;
        supplierName: string;
        amountTolerance?: number | undefined;
    }>, {
        count: number;
        matches: {
            id: unknown;
            concept: unknown;
            amount: unknown;
            docNumber: unknown;
            date: string | null;
            supplierName: string | null;
            sourceDocumentLink: string | null;
        }[];
    }> & {
        execute: (args: {
            amount: number;
            supplierName: string;
            amountTolerance: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            matches: {
                id: unknown;
                concept: unknown;
                amount: unknown;
                docNumber: unknown;
                date: string | null;
                supplierName: string | null;
                sourceDocumentLink: string | null;
            }[];
        }>;
    };
    markInvoiceAsPaid: import("ai").Tool<import("zod").ZodObject<{
        invoiceId: import("zod").ZodString;
        supplierName: import("zod").ZodString;
        docNumber: import("zod").ZodString;
        paidDate: import("zod").ZodString;
        amount: import("zod").ZodNumber;
    }, "strip", import("zod").ZodTypeAny, {
        amount: number;
        docNumber: string;
        supplierName: string;
        paidDate: string;
        invoiceId: string;
    }, {
        amount: number;
        docNumber: string;
        supplierName: string;
        paidDate: string;
        invoiceId: string;
    }>, unknown> & {
        execute: undefined;
    };
    searchContracts: import("ai").Tool<import("zod").ZodObject<{
        query: import("zod").ZodString;
        contractId: import("zod").ZodOptional<import("zod").ZodString>;
        topK: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
        query: string;
        topK: number;
        contractId?: string | undefined;
    }, {
        query: string;
        contractId?: string | undefined;
        topK?: number | undefined;
    }>, {
        count: number;
        results: never[];
        note: string;
        error?: undefined;
    } | {
        count: number;
        results: {
            contractId: string;
            contractTitle: string | null | undefined;
            chunkIndex: number;
            text: string;
            score: number;
        }[];
        note?: undefined;
        error?: undefined;
    } | {
        count: number;
        results: never[];
        error: string;
        note?: undefined;
    }> & {
        execute: (args: {
            query: string;
            topK: number;
            contractId?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            results: never[];
            note: string;
            error?: undefined;
        } | {
            count: number;
            results: {
                contractId: string;
                contractTitle: string | null | undefined;
                chunkIndex: number;
                text: string;
                score: number;
            }[];
            note?: undefined;
            error?: undefined;
        } | {
            count: number;
            results: never[];
            error: string;
            note?: undefined;
        }>;
    };
    summarizeContract: import("ai").Tool<import("zod").ZodObject<{
        contractId: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        contractId: string;
    }, {
        contractId: string;
    }>, {
        contractId: string;
        summary: null;
        note: string;
        contractTitle?: undefined;
        chunkCount?: undefined;
        error?: undefined;
    } | {
        contractId: string;
        contractTitle: string | null;
        summary: string;
        chunkCount: number;
        note?: undefined;
        error?: undefined;
    } | {
        contractId: string;
        summary: null;
        error: string;
        note?: undefined;
        contractTitle?: undefined;
        chunkCount?: undefined;
    }> & {
        execute: (args: {
            contractId: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            contractId: string;
            summary: null;
            note: string;
            contractTitle?: undefined;
            chunkCount?: undefined;
            error?: undefined;
        } | {
            contractId: string;
            contractTitle: string | null;
            summary: string;
            chunkCount: number;
            note?: undefined;
            error?: undefined;
        } | {
            contractId: string;
            summary: null;
            error: string;
            note?: undefined;
            contractTitle?: undefined;
            chunkCount?: undefined;
        }>;
    };
    listScheduledReports: import("ai").Tool<import("zod").ZodObject<{
        enabledOnly: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodBoolean>>;
    }, "strip", import("zod").ZodTypeAny, {
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
    createScheduledReport: import("ai").Tool<import("zod").ZodObject<{
        name: import("zod").ZodString;
        reportType: import("zod").ZodEnum<["pnl", "cashflow", "sales", "expenses", "executive"]>;
        period: import("zod").ZodEnum<["daily", "weekly", "monthly"]>;
        dayOfWeek: import("zod").ZodOptional<import("zod").ZodNumber>;
        dayOfMonth: import("zod").ZodOptional<import("zod").ZodNumber>;
        hour: import("zod").ZodNumber;
        channel: import("zod").ZodEnum<["email", "whatsapp", "firestore"]>;
        recipient: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
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
    toggleScheduledReport: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
        enabled: import("zod").ZodBoolean;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
        enabled: boolean;
    }, {
        id: string;
        enabled: boolean;
    }>, unknown> & {
        execute: undefined;
    };
    deleteScheduledReport: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>, unknown> & {
        execute: undefined;
    };
    saveToObsidian: import("ai").Tool<import("zod").ZodObject<{
        title: import("zod").ZodString;
        content: import("zod").ZodString;
        folder: import("zod").ZodOptional<import("zod").ZodString>;
        tags: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
        frontmatter: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>>;
    }, "strip", import("zod").ZodTypeAny, {
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
    proposeMultiStepPlan: import("ai").Tool<import("zod").ZodObject<{
        title: import("zod").ZodString;
        rationale: import("zod").ZodString;
        steps: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            label: import("zod").ZodString;
            toolName: import("zod").ZodString;
            toolArgs: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>;
            optional: import("zod").ZodOptional<import("zod").ZodBoolean>;
        }, "strip", import("zod").ZodTypeAny, {
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
    }, "strip", import("zod").ZodTypeAny, {
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
    getDetectedAnomalies: import("ai").Tool<import("zod").ZodObject<{
        severity: import("zod").ZodOptional<import("zod").ZodEnum<["info", "warning"]>>;
        since: import("zod").ZodOptional<import("zod").ZodString>;
        includeAcknowledged: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodBoolean>>;
        limit: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
        limit: number;
        includeAcknowledged: boolean;
        severity?: "warning" | "info" | undefined;
        since?: string | undefined;
    }, {
        limit?: number | undefined;
        severity?: "warning" | "info" | undefined;
        since?: string | undefined;
        includeAcknowledged?: boolean | undefined;
    }>, {
        totalCount: number;
        unacknowledgedCount: number;
        returnedCount: number;
        anomalies: {
            id: unknown;
            severity: {};
            title: unknown;
            description: {};
            evidence: {};
            acknowledged: boolean;
            createdAt: string | null;
        }[];
    }> & {
        execute: (args: {
            limit: number;
            includeAcknowledged: boolean;
            severity?: "warning" | "info" | undefined;
            since?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            totalCount: number;
            unacknowledgedCount: number;
            returnedCount: number;
            anomalies: {
                id: unknown;
                severity: {};
                title: unknown;
                description: {};
                evidence: {};
                acknowledged: boolean;
                createdAt: string | null;
            }[];
        }>;
    };
    acknowledgeAnomaly: import("ai").Tool<import("zod").ZodObject<{
        notificationId: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        notificationId: string;
    }, {
        notificationId: string;
    }>, unknown> & {
        execute: undefined;
    };
    updateThreadState: import("ai").Tool<import("zod").ZodObject<{
        contextPatch: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>>;
        nextActionsAddOrRemove: import("zod").ZodOptional<import("zod").ZodObject<{
            add: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
            remove: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString, "many">>;
        }, "strip", import("zod").ZodTypeAny, {
            add?: string[] | undefined;
            remove?: string[] | undefined;
        }, {
            add?: string[] | undefined;
            remove?: string[] | undefined;
        }>>;
        summary: import("zod").ZodOptional<import("zod").ZodString>;
        status: import("zod").ZodOptional<import("zod").ZodEnum<["in_progress", "done", "blocked"]>>;
    }, "strip", import("zod").ZodTypeAny, {
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
    getPosSales: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
        localId: import("zod").ZodOptional<import("zod").ZodNumber>;
    }, "strip", import("zod").ZodTypeAny, {
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
    getSalesByPaymentMethod: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
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
    getTopProducts: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
        limit: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
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
    getSalesByLocation: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
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
    getPosSyncStatus: import("ai").Tool<import("zod").ZodObject<{}, "strip", import("zod").ZodTypeAny, {}, {}>, {
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
    getPosCatalog: import("ai").Tool<import("zod").ZodObject<{
        localId: import("zod").ZodOptional<import("zod").ZodNumber>;
        category: import("zod").ZodOptional<import("zod").ZodString>;
        limit: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
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
    searchPosProduct: import("ai").Tool<import("zod").ZodObject<{
        query: import("zod").ZodString;
        limit: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
        limit: number;
        query: string;
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
            limit: number;
            query: string;
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
    getProductsWithoutSales: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
        limit: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
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
    triggerPosReconcile: import("ai").Tool<import("zod").ZodObject<{
        days: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
        days: number;
    }, {
        days?: number | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    getInfluencerVisits: import("ai").Tool<import("zod").ZodObject<{
        status: import("zod").ZodOptional<import("zod").ZodEnum<["pending", "completed"]>>;
        startDate: import("zod").ZodOptional<import("zod").ZodString>;
        endDate: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
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
    getInfluencerContentReport: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
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
    createInfluencerVisit: import("ai").Tool<import("zod").ZodObject<{
        name: import("zod").ZodString;
        socialNetworks: import("zod").ZodArray<import("zod").ZodObject<{
            platform: import("zod").ZodEnum<["instagram", "tiktok", "youtube", "facebook", "twitter", "other"]>;
            handle: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            platform: "instagram" | "tiktok" | "youtube" | "facebook" | "twitter" | "other";
            handle: string;
        }, {
            platform: "instagram" | "tiktok" | "youtube" | "facebook" | "twitter" | "other";
            handle: string;
        }>, "many">;
        visitDate: import("zod").ZodString;
        content: import("zod").ZodObject<{
            story: import("zod").ZodBoolean;
            post: import("zod").ZodBoolean;
            reel: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            story: boolean;
            post: boolean;
            reel: boolean;
        }, {
            story: boolean;
            post: boolean;
            reel: boolean;
        }>;
        notes: import("zod").ZodOptional<import("zod").ZodString>;
        status: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodEnum<["pending", "completed"]>>>;
    }, "strip", import("zod").ZodTypeAny, {
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
    getDailyClosings: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        count: number;
        dateRange: {
            startDate: string;
            endDate: string;
        };
        totals: {
            ap: number;
            qr: number;
            datafono: number;
            rappiVentas: number;
            efectivo: number;
            ventaTotal: number;
            propinas: number;
            gastos: number;
        };
        closings: {
            id: unknown;
            date: unknown;
            ap: number;
            qr: number;
            datafono: number;
            rappiVentas: number;
            efectivo: number;
            ventaTotal: number;
            propinas: number;
            gastos: number;
            cajaMenor: number;
            entregaEfectivo: number;
            responsable: unknown;
        }[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            dateRange: {
                startDate: string;
                endDate: string;
            };
            totals: {
                ap: number;
                qr: number;
                datafono: number;
                rappiVentas: number;
                efectivo: number;
                ventaTotal: number;
                propinas: number;
                gastos: number;
            };
            closings: {
                id: unknown;
                date: unknown;
                ap: number;
                qr: number;
                datafono: number;
                rappiVentas: number;
                efectivo: number;
                ventaTotal: number;
                propinas: number;
                gastos: number;
                cajaMenor: number;
                entregaEfectivo: number;
                responsable: unknown;
            }[];
        }>;
    };
    getDailyClosing: import("ai").Tool<import("zod").ZodObject<{
        date: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        date: string;
    }, {
        date: string;
    }>, {
        found: boolean;
        date: string;
        message: string;
        closing?: undefined;
    } | {
        found: boolean;
        closing: {
            id: unknown;
            date: unknown;
            ap: number;
            qr: number;
            datafono: number;
            rappiVentas: number;
            efectivo: number;
            ventaTotal: number;
            propinas: number;
            gastos: number;
            cajaMenor: number;
            entregaEfectivo: number;
            responsable: unknown;
        };
        date?: undefined;
        message?: undefined;
    }> & {
        execute: (args: {
            date: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            found: boolean;
            date: string;
            message: string;
            closing?: undefined;
        } | {
            found: boolean;
            closing: {
                id: unknown;
                date: unknown;
                ap: number;
                qr: number;
                datafono: number;
                rappiVentas: number;
                efectivo: number;
                ventaTotal: number;
                propinas: number;
                gastos: number;
                cajaMenor: number;
                entregaEfectivo: number;
                responsable: unknown;
            };
            date?: undefined;
            message?: undefined;
        }>;
    };
    getDiscountsReport: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
        reason: import("zod").ZodOptional<import("zod").ZodEnum<["Empleado", "Influencer", "Socio", "Prueba de calidad", "Otro"]>>;
    }, "strip", import("zod").ZodTypeAny, {
        startDate: string;
        endDate: string;
        reason?: "Empleado" | "Influencer" | "Socio" | "Prueba de calidad" | "Otro" | undefined;
    }, {
        startDate: string;
        endDate: string;
        reason?: "Empleado" | "Influencer" | "Socio" | "Prueba de calidad" | "Otro" | undefined;
    }>, {
        count: number;
        totalAmount: number;
        dateRange: {
            startDate: string;
            endDate: string;
        };
        byReason: Record<string, {
            count: number;
            amount: number;
        }>;
        discounts: {
            id: unknown;
            date: unknown;
            type: unknown;
            amount: number;
            reason: unknown;
            description: unknown;
            authorizedBy: unknown;
        }[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
            reason?: "Empleado" | "Influencer" | "Socio" | "Prueba de calidad" | "Otro" | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            totalAmount: number;
            dateRange: {
                startDate: string;
                endDate: string;
            };
            byReason: Record<string, {
                count: number;
                amount: number;
            }>;
            discounts: {
                id: unknown;
                date: unknown;
                type: unknown;
                amount: number;
                reason: unknown;
                description: unknown;
                authorizedBy: unknown;
            }[];
        }>;
    };
    getTipsSummary: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
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
        daysWithClosing: number;
        totalTips: number;
        avgDailyTips: number;
        byDay: {
            date: string;
            tips: number;
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
            daysWithClosing: number;
            totalTips: number;
            avgDailyTips: number;
            byDay: {
                date: string;
                tips: number;
            }[];
        }>;
    };
    createDailyClosing: import("ai").Tool<import("zod").ZodObject<{
        date: import("zod").ZodString;
        ap: import("zod").ZodNumber;
        qr: import("zod").ZodNumber;
        datafono: import("zod").ZodNumber;
        rappiVentas: import("zod").ZodNumber;
        efectivo: import("zod").ZodNumber;
        propinas: import("zod").ZodNumber;
        gastos: import("zod").ZodNumber;
        cajaMenor: import("zod").ZodNumber;
        entregaEfectivo: import("zod").ZodNumber;
        responsable: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        date: string;
        propinas: number;
        ap: number;
        qr: number;
        datafono: number;
        rappiVentas: number;
        efectivo: number;
        gastos: number;
        cajaMenor: number;
        entregaEfectivo: number;
        responsable: string;
    }, {
        date: string;
        propinas: number;
        ap: number;
        qr: number;
        datafono: number;
        rappiVentas: number;
        efectivo: number;
        gastos: number;
        cajaMenor: number;
        entregaEfectivo: number;
        responsable: string;
    }>, unknown> & {
        execute: undefined;
    };
    getNotifications: import("ai").Tool<import("zod").ZodObject<{
        onlyUnread: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodBoolean>>;
        type: import("zod").ZodOptional<import("zod").ZodEnum<["weekly-report", "overdue-alert", "closing-reminder", "price-increase"]>>;
        limit: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
        limit: number;
        onlyUnread: boolean;
        type?: "weekly-report" | "overdue-alert" | "closing-reminder" | "price-increase" | undefined;
    }, {
        type?: "weekly-report" | "overdue-alert" | "closing-reminder" | "price-increase" | undefined;
        limit?: number | undefined;
        onlyUnread?: boolean | undefined;
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
            limit: number;
            onlyUnread: boolean;
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
    markNotificationsRead: import("ai").Tool<import("zod").ZodObject<{
        ids: import("zod").ZodArray<import("zod").ZodString, "many">;
    }, "strip", import("zod").ZodTypeAny, {
        ids: string[];
    }, {
        ids: string[];
    }>, unknown> & {
        execute: undefined;
    };
    createNotification: import("ai").Tool<import("zod").ZodObject<{
        type: import("zod").ZodEnum<["weekly-report", "overdue-alert", "closing-reminder", "price-increase"]>;
        title: import("zod").ZodString;
        summary: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        title: string;
        type: "weekly-report" | "overdue-alert" | "closing-reminder" | "price-increase";
        summary: string;
    }, {
        title: string;
        type: "weekly-report" | "overdue-alert" | "closing-reminder" | "price-increase";
        summary: string;
    }>, unknown> & {
        execute: undefined;
    };
    generateMonthClosingPreview: import("ai").Tool<import("zod").ZodObject<{
        year: import("zod").ZodNumber;
        month: import("zod").ZodNumber;
    }, "strip", import("zod").ZodTypeAny, {
        month: number;
        year: number;
    }, {
        month: number;
        year: number;
    }>, {
        period: string;
        dateRange: {
            startDate: string;
            endDate: string;
        };
        financialSummary: {
            totalIncome: number;
            totalExpenses: number;
            netProfit: number;
            netMarginPercent: number;
            transactionCount: number;
            topExpenseCategories: {
                category: string;
                total: number;
                count: number;
            }[];
            topIncomeCategories: {
                category: string;
                total: number;
                count: number;
            }[];
        };
        budget: {
            budgetedExpenses: number;
            actualExpenses: number;
            executionPercent: number | null;
        };
        status: {
            overdueCount: number;
            overdueTotal: number;
            pendingCount: number;
            pendingTotal: number;
            pendingRecurringCount: number;
            activeEmployees: number;
        };
        pendingActions: string[];
        hasActionsRequired: boolean;
    }> & {
        execute: (args: {
            month: number;
            year: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            period: string;
            dateRange: {
                startDate: string;
                endDate: string;
            };
            financialSummary: {
                totalIncome: number;
                totalExpenses: number;
                netProfit: number;
                netMarginPercent: number;
                transactionCount: number;
                topExpenseCategories: {
                    category: string;
                    total: number;
                    count: number;
                }[];
                topIncomeCategories: {
                    category: string;
                    total: number;
                    count: number;
                }[];
            };
            budget: {
                budgetedExpenses: number;
                actualExpenses: number;
                executionPercent: number | null;
            };
            status: {
                overdueCount: number;
                overdueTotal: number;
                pendingCount: number;
                pendingTotal: number;
                pendingRecurringCount: number;
                activeEmployees: number;
            };
            pendingActions: string[];
            hasActionsRequired: boolean;
        }>;
    };
    executeMonthClosing: import("ai").Tool<import("zod").ZodObject<{
        year: import("zod").ZodNumber;
        month: import("zod").ZodNumber;
        periodLabel: import("zod").ZodString;
        generateRecurring: import("zod").ZodBoolean;
        pendingRecurringCount: import("zod").ZodNumber;
    }, "strip", import("zod").ZodTypeAny, {
        month: number;
        year: number;
        periodLabel: string;
        generateRecurring: boolean;
        pendingRecurringCount: number;
    }, {
        month: number;
        year: number;
        periodLabel: string;
        generateRecurring: boolean;
        pendingRecurringCount: number;
    }>, unknown> & {
        execute: undefined;
    };
    getWeeklyObligations: import("ai").Tool<import("zod").ZodObject<{
        weekStartDate: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        weekStartDate?: string | undefined;
    }, {
        weekStartDate?: string | undefined;
    }>, {
        weekRange: {
            start: string;
            end: string;
        };
        totalObligations: number;
        totalAmount: number;
        overdueCount: number;
        overdueAmount: number;
        obligations: ({
            type: "expense";
            id: unknown;
            concept: string;
            category: string;
            amount: number;
            date: string | null;
            isOverdue: boolean;
            urgency: string;
            priority: number;
        } | {
            type: "recurring";
            id: unknown;
            concept: string;
            category: string;
            amount: number;
            date: string | null;
            isOverdue: boolean;
            urgency: "recurring_due";
            priority: number;
        })[];
    }> & {
        execute: (args: {
            weekStartDate?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            weekRange: {
                start: string;
                end: string;
            };
            totalObligations: number;
            totalAmount: number;
            overdueCount: number;
            overdueAmount: number;
            obligations: ({
                type: "expense";
                id: unknown;
                concept: string;
                category: string;
                amount: number;
                date: string | null;
                isOverdue: boolean;
                urgency: string;
                priority: number;
            } | {
                type: "recurring";
                id: unknown;
                concept: string;
                category: string;
                amount: number;
                date: string | null;
                isOverdue: boolean;
                urgency: "recurring_due";
                priority: number;
            })[];
        }>;
    };
    getOverdueCollections: import("ai").Tool<import("zod").ZodObject<{
        minDaysOverdue: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
        minDaysOverdue: number;
    }, {
        minDaysOverdue?: number | undefined;
    }>, {
        totalPending: number;
        totalAmount: number;
        criticalCount: number;
        highCount: number;
        items: {
            id: unknown;
            concept: string;
            category: string;
            amount: number;
            date: string | null;
            status: string;
            daysOverdue: number;
            urgency: string;
        }[];
        collectionTemplates: {
            concept: string;
            amount: number;
            daysOverdue: number;
            whatsappTemplate: string;
            emailSubject: string;
            emailBody: string;
        }[];
    }> & {
        execute: (args: {
            minDaysOverdue: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            totalPending: number;
            totalAmount: number;
            criticalCount: number;
            highCount: number;
            items: {
                id: unknown;
                concept: string;
                category: string;
                amount: number;
                date: string | null;
                status: string;
                daysOverdue: number;
                urgency: string;
            }[];
            collectionTemplates: {
                concept: string;
                amount: number;
                daysOverdue: number;
                whatsappTemplate: string;
                emailSubject: string;
                emailBody: string;
            }[];
        }>;
    };
    exportReport: import("ai").Tool<import("zod").ZodObject<{
        format: import("zod").ZodEnum<["pdf", "excel"]>;
        title: import("zod").ZodString;
        sections: import("zod").ZodArray<import("zod").ZodObject<{
            heading: import("zod").ZodString;
            type: import("zod").ZodEnum<["table", "kpi", "text"]>;
            data: import("zod").ZodUnknown;
        }, "strip", import("zod").ZodTypeAny, {
            type: "table" | "kpi" | "text";
            heading: string;
            data?: unknown;
        }, {
            type: "table" | "kpi" | "text";
            heading: string;
            data?: unknown;
        }>, "many">;
    }, "strip", import("zod").ZodTypeAny, {
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
    generateChart: import("ai").Tool<import("zod").ZodObject<{
        chartType: import("zod").ZodEnum<["bar", "pie", "area", "line"]>;
        title: import("zod").ZodString;
        data: import("zod").ZodArray<import("zod").ZodObject<{
            name: import("zod").ZodString;
            value: import("zod").ZodNumber;
            value2: import("zod").ZodOptional<import("zod").ZodNumber>;
        }, "strip", import("zod").ZodTypeAny, {
            name: string;
            value: number;
            value2?: number | undefined;
        }, {
            name: string;
            value: number;
            value2?: number | undefined;
        }>, "many">;
        valueLabel: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodString>>;
        value2Label: import("zod").ZodOptional<import("zod").ZodString>;
        formatAsCurrency: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodBoolean>>;
    }, "strip", import("zod").ZodTypeAny, {
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
    searchAll: import("ai").Tool<import("zod").ZodObject<{
        query: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        query: string;
    }, {
        query: string;
    }>, {
        query: string;
        totalResults: number;
        employees: {
            count: number;
            results: {
                id: unknown;
                name: unknown;
                role: unknown;
                department: unknown;
                email: unknown;
                status: unknown;
            }[];
        };
        suppliers: {
            count: number;
            results: {
                id: unknown;
                name: unknown;
                category: unknown;
                contactName: unknown;
                status: unknown;
            }[];
        };
        transactions: {
            count: number;
            results: {
                id: unknown;
                concept: unknown;
                category: unknown;
                amount: unknown;
                type: unknown;
                date: string | null;
                status: unknown;
            }[];
        };
        contracts: {
            count: number;
            results: {
                id: unknown;
                title: unknown;
                employeeName: unknown;
                templateName: unknown;
                startDate: string | null;
                endDate: string | null;
            }[];
        };
    }> & {
        execute: (args: {
            query: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            query: string;
            totalResults: number;
            employees: {
                count: number;
                results: {
                    id: unknown;
                    name: unknown;
                    role: unknown;
                    department: unknown;
                    email: unknown;
                    status: unknown;
                }[];
            };
            suppliers: {
                count: number;
                results: {
                    id: unknown;
                    name: unknown;
                    category: unknown;
                    contactName: unknown;
                    status: unknown;
                }[];
            };
            transactions: {
                count: number;
                results: {
                    id: unknown;
                    concept: unknown;
                    category: unknown;
                    amount: unknown;
                    type: unknown;
                    date: string | null;
                    status: unknown;
                }[];
            };
            contracts: {
                count: number;
                results: {
                    id: unknown;
                    title: unknown;
                    employeeName: unknown;
                    templateName: unknown;
                    startDate: string | null;
                    endDate: string | null;
                }[];
            };
        }>;
    };
    getBudget: import("ai").Tool<import("zod").ZodObject<{}, "strip", import("zod").ZodTypeAny, {}, {}>, {
        itemCount: number;
        totalBudgetedIncome: number;
        totalBudgetedExpense: number;
        netBudgeted: number;
        income: {
            category: string;
            type: string;
            amount: number;
        }[];
        expense: {
            category: string;
            type: string;
            amount: number;
        }[];
    }> & {
        execute: (args: {}, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            itemCount: number;
            totalBudgetedIncome: number;
            totalBudgetedExpense: number;
            netBudgeted: number;
            income: {
                category: string;
                type: string;
                amount: number;
            }[];
            expense: {
                category: string;
                type: string;
                amount: number;
            }[];
        }>;
    };
    updateBudget: import("ai").Tool<import("zod").ZodObject<{
        category: import("zod").ZodString;
        type: import("zod").ZodEnum<["income", "expense"]>;
        amount: import("zod").ZodNumber;
    }, "strip", import("zod").ZodTypeAny, {
        type: "income" | "expense";
        category: string;
        amount: number;
    }, {
        type: "income" | "expense";
        category: string;
        amount: number;
    }>, unknown> & {
        execute: undefined;
    };
    addBudgetItem: import("ai").Tool<import("zod").ZodObject<{
        category: import("zod").ZodString;
        type: import("zod").ZodEnum<["income", "expense"]>;
        amount: import("zod").ZodNumber;
    }, "strip", import("zod").ZodTypeAny, {
        type: "income" | "expense";
        category: string;
        amount: number;
    }, {
        type: "income" | "expense";
        category: string;
        amount: number;
    }>, unknown> & {
        execute: undefined;
    };
    deleteBudgetItem: import("ai").Tool<import("zod").ZodObject<{
        category: import("zod").ZodString;
        type: import("zod").ZodEnum<["income", "expense"]>;
    }, "strip", import("zod").ZodTypeAny, {
        type: "income" | "expense";
        category: string;
    }, {
        type: "income" | "expense";
        category: string;
    }>, unknown> & {
        execute: undefined;
    };
    getBusinessAlerts: import("ai").Tool<import("zod").ZodObject<{
        daysAhead: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
        daysAhead: number;
    }, {
        daysAhead?: number | undefined;
    }>, {
        totalAlerts: number;
        dangerCount: number;
        warningCount: number;
        infoCount: number;
        alerts: import("./alerts-tools.js").Alert[];
    }> & {
        execute: (args: {
            daysAhead: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            totalAlerts: number;
            dangerCount: number;
            warningCount: number;
            infoCount: number;
            alerts: import("./alerts-tools.js").Alert[];
        }>;
    };
    getContracts: import("ai").Tool<import("zod").ZodObject<{
        employeeName: import("zod").ZodOptional<import("zod").ZodString>;
        status: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        status?: string | undefined;
        employeeName?: string | undefined;
    }, {
        status?: string | undefined;
        employeeName?: string | undefined;
    }>, {
        count: number;
        contracts: {
            id: unknown;
            title: unknown;
            employeeName: unknown;
            employeeId: unknown;
            templateName: unknown;
            status: unknown;
            startDate: unknown;
            endDate: unknown;
            createdAt: string | null;
            salary: unknown;
            position: unknown;
            department: unknown;
        }[];
    }> & {
        execute: (args: {
            status?: string | undefined;
            employeeName?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            contracts: {
                id: unknown;
                title: unknown;
                employeeName: unknown;
                employeeId: unknown;
                templateName: unknown;
                status: unknown;
                startDate: unknown;
                endDate: unknown;
                createdAt: string | null;
                salary: unknown;
                position: unknown;
                department: unknown;
            }[];
        }>;
    };
    getContractTemplates: import("ai").Tool<import("zod").ZodObject<{}, "strip", import("zod").ZodTypeAny, {}, {}>, {
        count: number;
        templates: {
            id: unknown;
            name: unknown;
            description: unknown;
            clauseCount: number;
        }[];
    }> & {
        execute: (args: {}, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            templates: {
                id: unknown;
                name: unknown;
                description: unknown;
                clauseCount: number;
            }[];
        }>;
    };
    getExpiringContracts: import("ai").Tool<import("zod").ZodObject<{
        days: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
        days: number;
    }, {
        days?: number | undefined;
    }>, {
        expiringCount: number;
        expiredCount: number;
        expiring: {
            id: unknown;
            title: unknown;
            employeeName: unknown;
            employeeId: unknown;
            templateName: unknown;
            status: unknown;
            startDate: unknown;
            endDate: unknown;
            createdAt: string | null;
            salary: unknown;
            position: unknown;
            department: unknown;
        }[];
        expired: {
            id: unknown;
            title: unknown;
            employeeName: unknown;
            employeeId: unknown;
            templateName: unknown;
            status: unknown;
            startDate: unknown;
            endDate: unknown;
            createdAt: string | null;
            salary: unknown;
            position: unknown;
            department: unknown;
        }[];
        searchDays: number;
    }> & {
        execute: (args: {
            days: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            expiringCount: number;
            expiredCount: number;
            expiring: {
                id: unknown;
                title: unknown;
                employeeName: unknown;
                employeeId: unknown;
                templateName: unknown;
                status: unknown;
                startDate: unknown;
                endDate: unknown;
                createdAt: string | null;
                salary: unknown;
                position: unknown;
                department: unknown;
            }[];
            expired: {
                id: unknown;
                title: unknown;
                employeeName: unknown;
                employeeId: unknown;
                templateName: unknown;
                status: unknown;
                startDate: unknown;
                endDate: unknown;
                createdAt: string | null;
                salary: unknown;
                position: unknown;
                department: unknown;
            }[];
            searchDays: number;
        }>;
    };
    createContractTemplate: import("ai").Tool<import("zod").ZodObject<{
        name: import("zod").ZodString;
        contractType: import("zod").ZodEnum<["indefinido", "fijo", "obra_labor", "aprendizaje", "prestacion_servicios"]>;
        position: import("zod").ZodString;
        description: import("zod").ZodString;
        clauses: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            title: import("zod").ZodString;
            content: import("zod").ZodString;
            isRequired: import("zod").ZodBoolean;
            isEditable: import("zod").ZodBoolean;
            order: import("zod").ZodNumber;
            category: import("zod").ZodEnum<["mandatory", "optional", "position_specific"]>;
        }, "strip", import("zod").ZodTypeAny, {
            title: string;
            id: string;
            category: "mandatory" | "optional" | "position_specific";
            content: string;
            isRequired: boolean;
            isEditable: boolean;
            order: number;
        }, {
            title: string;
            id: string;
            category: "mandatory" | "optional" | "position_specific";
            content: string;
            isRequired: boolean;
            isEditable: boolean;
            order: number;
        }>, "many">;
        isDefault: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodBoolean>>;
    }, "strip", import("zod").ZodTypeAny, {
        description: string;
        name: string;
        position: string;
        clauses: {
            title: string;
            id: string;
            category: "mandatory" | "optional" | "position_specific";
            content: string;
            isRequired: boolean;
            isEditable: boolean;
            order: number;
        }[];
        contractType: "indefinido" | "fijo" | "obra_labor" | "aprendizaje" | "prestacion_servicios";
        isDefault: boolean;
    }, {
        description: string;
        name: string;
        position: string;
        clauses: {
            title: string;
            id: string;
            category: "mandatory" | "optional" | "position_specific";
            content: string;
            isRequired: boolean;
            isEditable: boolean;
            order: number;
        }[];
        contractType: "indefinido" | "fijo" | "obra_labor" | "aprendizaje" | "prestacion_servicios";
        isDefault?: boolean | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    updateContractTemplate: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
        name: import("zod").ZodOptional<import("zod").ZodString>;
        position: import("zod").ZodOptional<import("zod").ZodString>;
        description: import("zod").ZodOptional<import("zod").ZodString>;
        isDefault: import("zod").ZodOptional<import("zod").ZodBoolean>;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
        description?: string | undefined;
        name?: string | undefined;
        position?: string | undefined;
        isDefault?: boolean | undefined;
    }, {
        id: string;
        description?: string | undefined;
        name?: string | undefined;
        position?: string | undefined;
        isDefault?: boolean | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    deleteContractTemplate: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
        name: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>, unknown> & {
        execute: undefined;
    };
    createContractFromTemplate: import("ai").Tool<import("zod").ZodObject<{
        templateId: import("zod").ZodString;
        employeeId: import("zod").ZodOptional<import("zod").ZodString>;
        employeeName: import("zod").ZodString;
        employeeIdentification: import("zod").ZodString;
        position: import("zod").ZodString;
        salary: import("zod").ZodNumber;
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        salary: number;
        startDate: string;
        employeeName: string;
        position: string;
        templateId: string;
        employeeIdentification: string;
        endDate?: string | undefined;
        employeeId?: string | undefined;
    }, {
        salary: number;
        startDate: string;
        employeeName: string;
        position: string;
        templateId: string;
        employeeIdentification: string;
        endDate?: string | undefined;
        employeeId?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    createEmployee: import("ai").Tool<import("zod").ZodObject<{
        name: import("zod").ZodString;
        identification: import("zod").ZodString;
        role: import("zod").ZodString;
        department: import("zod").ZodString;
        email: import("zod").ZodString;
        phone: import("zod").ZodString;
        salary: import("zod").ZodNumber;
        startDate: import("zod").ZodString;
        status: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodEnum<["active", "inactive"]>>>;
    }, "strip", import("zod").ZodTypeAny, {
        name: string;
        identification: string;
        role: string;
        department: string;
        email: string;
        phone: string;
        salary: number;
        startDate: string;
        status: "active" | "inactive";
    }, {
        name: string;
        identification: string;
        role: string;
        department: string;
        email: string;
        phone: string;
        salary: number;
        startDate: string;
        status?: "active" | "inactive" | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    updateEmployee: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
        name: import("zod").ZodOptional<import("zod").ZodString>;
        role: import("zod").ZodOptional<import("zod").ZodString>;
        department: import("zod").ZodOptional<import("zod").ZodString>;
        email: import("zod").ZodOptional<import("zod").ZodString>;
        phone: import("zod").ZodOptional<import("zod").ZodString>;
        salary: import("zod").ZodOptional<import("zod").ZodNumber>;
        status: import("zod").ZodOptional<import("zod").ZodEnum<["active", "inactive"]>>;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
        name?: string | undefined;
        role?: string | undefined;
        department?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        salary?: number | undefined;
        status?: "active" | "inactive" | undefined;
    }, {
        id: string;
        name?: string | undefined;
        role?: string | undefined;
        department?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        salary?: number | undefined;
        status?: "active" | "inactive" | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    deleteEmployee: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
        name: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>, unknown> & {
        execute: undefined;
    };
    createSupplier: import("ai").Tool<import("zod").ZodObject<{
        name: import("zod").ZodString;
        identification: import("zod").ZodString;
        category: import("zod").ZodString;
        contactName: import("zod").ZodString;
        email: import("zod").ZodString;
        phone: import("zod").ZodString;
        contractStart: import("zod").ZodString;
        contractEnd: import("zod").ZodString;
        status: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodEnum<["active", "expired", "pending"]>>>;
    }, "strip", import("zod").ZodTypeAny, {
        name: string;
        identification: string;
        email: string;
        phone: string;
        status: "active" | "expired" | "pending";
        category: string;
        contactName: string;
        contractStart: string;
        contractEnd: string;
    }, {
        name: string;
        identification: string;
        email: string;
        phone: string;
        category: string;
        contactName: string;
        contractStart: string;
        contractEnd: string;
        status?: "active" | "expired" | "pending" | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    updateSupplier: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
        name: import("zod").ZodOptional<import("zod").ZodString>;
        category: import("zod").ZodOptional<import("zod").ZodString>;
        contactName: import("zod").ZodOptional<import("zod").ZodString>;
        email: import("zod").ZodOptional<import("zod").ZodString>;
        phone: import("zod").ZodOptional<import("zod").ZodString>;
        status: import("zod").ZodOptional<import("zod").ZodEnum<["active", "expired", "pending"]>>;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        status?: "active" | "expired" | "pending" | undefined;
        category?: string | undefined;
        contactName?: string | undefined;
    }, {
        id: string;
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
        status?: "active" | "expired" | "pending" | undefined;
        category?: string | undefined;
        contactName?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    deleteSupplier: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
        name: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>, unknown> & {
        execute: undefined;
    };
    createTransaction: import("ai").Tool<import("zod").ZodObject<{
        concept: import("zod").ZodString;
        category: import("zod").ZodString;
        amount: import("zod").ZodNumber;
        type: import("zod").ZodEnum<["income", "expense"]>;
        date: import("zod").ZodString;
        status: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodEnum<["paid", "pending"]>>>;
        notes: import("zod").ZodOptional<import("zod").ZodString>;
        payeeType: import("zod").ZodOptional<import("zod").ZodEnum<["partner", "employee", "supplier", "external"]>>;
        payeeName: import("zod").ZodOptional<import("zod").ZodString>;
        targetCompanyName: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        status: "pending" | "paid";
        type: "income" | "expense";
        date: string;
        category: string;
        concept: string;
        amount: number;
        notes?: string | undefined;
        payeeName?: string | undefined;
        payeeType?: "partner" | "employee" | "supplier" | "external" | undefined;
        targetCompanyName?: string | undefined;
    }, {
        type: "income" | "expense";
        date: string;
        category: string;
        concept: string;
        amount: number;
        status?: "pending" | "paid" | undefined;
        notes?: string | undefined;
        payeeName?: string | undefined;
        payeeType?: "partner" | "employee" | "supplier" | "external" | undefined;
        targetCompanyName?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    createSplitExpense: import("ai").Tool<import("zod").ZodObject<{
        concept: import("zod").ZodString;
        category: import("zod").ZodString;
        totalAmount: import("zod").ZodNumber;
        date: import("zod").ZodString;
        payeeType: import("zod").ZodEnum<["partner", "employee", "supplier", "external"]>;
        payeeName: import("zod").ZodString;
        splits: import("zod").ZodArray<import("zod").ZodObject<{
            companyName: import("zod").ZodString;
            amount: import("zod").ZodOptional<import("zod").ZodNumber>;
            percentage: import("zod").ZodOptional<import("zod").ZodNumber>;
        }, "strip", import("zod").ZodTypeAny, {
            companyName: string;
            amount?: number | undefined;
            percentage?: number | undefined;
        }, {
            companyName: string;
            amount?: number | undefined;
            percentage?: number | undefined;
        }>, "many">;
        splitMode: import("zod").ZodEnum<["equal", "amounts", "percentages"]>;
        notes: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        date: string;
        category: string;
        concept: string;
        payeeName: string;
        totalAmount: number;
        payeeType: "partner" | "employee" | "supplier" | "external";
        splits: {
            companyName: string;
            amount?: number | undefined;
            percentage?: number | undefined;
        }[];
        splitMode: "equal" | "amounts" | "percentages";
        notes?: string | undefined;
    }, {
        date: string;
        category: string;
        concept: string;
        payeeName: string;
        totalAmount: number;
        payeeType: "partner" | "employee" | "supplier" | "external";
        splits: {
            companyName: string;
            amount?: number | undefined;
            percentage?: number | undefined;
        }[];
        splitMode: "equal" | "amounts" | "percentages";
        notes?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    updateTransaction: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
        concept: import("zod").ZodOptional<import("zod").ZodString>;
        category: import("zod").ZodOptional<import("zod").ZodString>;
        amount: import("zod").ZodOptional<import("zod").ZodNumber>;
        type: import("zod").ZodOptional<import("zod").ZodEnum<["income", "expense"]>>;
        date: import("zod").ZodOptional<import("zod").ZodString>;
        status: import("zod").ZodOptional<import("zod").ZodEnum<["paid", "pending"]>>;
        notes: import("zod").ZodOptional<import("zod").ZodString>;
        priority: import("zod").ZodOptional<import("zod").ZodEnum<["immediate", "waiting"]>>;
        documentKind: import("zod").ZodOptional<import("zod").ZodEnum<["invoice", "purchase"]>>;
        paidDate: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
        status?: "pending" | "paid" | undefined;
        type?: "income" | "expense" | undefined;
        date?: string | undefined;
        category?: string | undefined;
        concept?: string | undefined;
        amount?: number | undefined;
        notes?: string | undefined;
        priority?: "immediate" | "waiting" | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
        paidDate?: string | undefined;
    }, {
        id: string;
        status?: "pending" | "paid" | undefined;
        type?: "income" | "expense" | undefined;
        date?: string | undefined;
        category?: string | undefined;
        concept?: string | undefined;
        amount?: number | undefined;
        notes?: string | undefined;
        priority?: "immediate" | "waiting" | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
        paidDate?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    deleteTransaction: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
        concept: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
        concept: string;
    }, {
        id: string;
        concept: string;
    }>, unknown> & {
        execute: undefined;
    };
    quickMarkInvoiceAsPaid: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
        concept: import("zod").ZodString;
        amount: import("zod").ZodNumber;
        supplierName: import("zod").ZodOptional<import("zod").ZodString>;
        paidDate: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
        concept: string;
        amount: number;
        supplierName?: string | undefined;
        paidDate?: string | undefined;
    }, {
        id: string;
        concept: string;
        amount: number;
        supplierName?: string | undefined;
        paidDate?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    bulkMarkAsPaid: import("ai").Tool<import("zod").ZodObject<{
        items: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            concept: import("zod").ZodString;
            amount: import("zod").ZodOptional<import("zod").ZodNumber>;
        }, "strip", import("zod").ZodTypeAny, {
            id: string;
            concept: string;
            amount?: number | undefined;
        }, {
            id: string;
            concept: string;
            amount?: number | undefined;
        }>, "many">;
        summary: import("zod").ZodString;
        paidDate: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        items: {
            id: string;
            concept: string;
            amount?: number | undefined;
        }[];
        summary: string;
        paidDate?: string | undefined;
    }, {
        items: {
            id: string;
            concept: string;
            amount?: number | undefined;
        }[];
        summary: string;
        paidDate?: string | undefined;
    }>, unknown> & {
        execute: undefined;
    };
    bulkSetPriority: import("ai").Tool<import("zod").ZodObject<{
        items: import("zod").ZodArray<import("zod").ZodObject<{
            id: import("zod").ZodString;
            concept: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            id: string;
            concept: string;
        }, {
            id: string;
            concept: string;
        }>, "many">;
        priority: import("zod").ZodEnum<["immediate", "waiting"]>;
        summary: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        priority: "immediate" | "waiting";
        items: {
            id: string;
            concept: string;
        }[];
        summary: string;
    }, {
        priority: "immediate" | "waiting";
        items: {
            id: string;
            concept: string;
        }[];
        summary: string;
    }>, unknown> & {
        execute: undefined;
    };
    analyzeExpensesTrend: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
        compareWithPrevious: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodBoolean>>;
    }, "strip", import("zod").ZodTypeAny, {
        startDate: string;
        endDate: string;
        compareWithPrevious: boolean;
    }, {
        startDate: string;
        endDate: string;
        compareWithPrevious?: boolean | undefined;
    }>, Record<string, unknown>> & {
        execute: (args: {
            startDate: string;
            endDate: string;
            compareWithPrevious: boolean;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<Record<string, unknown>>;
    };
    generateExecutiveReport: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        period: {
            startDate: string;
            endDate: string;
        };
        totalIncome: number;
        totalExpenses: number;
        netProfit: number;
        netMarginPercent: number;
        transactionCount: number;
        incomeChangeVsPrevPeriod: number;
        expenseChangeVsPrevPeriod: number;
        budgetedIncome: number;
        budgetedExpenses: number;
        budgetExpenseExecution: number | null;
        activeEmployees: number;
        activeSuppliers: number;
        pendingTransactions: number;
        overdueAmount: number;
        topExpenseCategories: import("./analysis-tools.js").CategoryTotal[];
        alerts: string[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            period: {
                startDate: string;
                endDate: string;
            };
            totalIncome: number;
            totalExpenses: number;
            netProfit: number;
            netMarginPercent: number;
            transactionCount: number;
            incomeChangeVsPrevPeriod: number;
            expenseChangeVsPrevPeriod: number;
            budgetedIncome: number;
            budgetedExpenses: number;
            budgetExpenseExecution: number | null;
            activeEmployees: number;
            activeSuppliers: number;
            pendingTransactions: number;
            overdueAmount: number;
            topExpenseCategories: import("./analysis-tools.js").CategoryTotal[];
            alerts: string[];
        }>;
    };
    getTransactions: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
        type: import("zod").ZodOptional<import("zod").ZodEnum<["income", "expense"]>>;
        category: import("zod").ZodOptional<import("zod").ZodString>;
        status: import("zod").ZodOptional<import("zod").ZodEnum<["paid", "pending", "overdue"]>>;
        priority: import("zod").ZodOptional<import("zod").ZodEnum<["immediate", "waiting"]>>;
        payeeName: import("zod").ZodOptional<import("zod").ZodString>;
        documentKind: import("zod").ZodOptional<import("zod").ZodEnum<["invoice", "purchase"]>>;
        overdueOnly: import("zod").ZodOptional<import("zod").ZodBoolean>;
    }, "strip", import("zod").ZodTypeAny, {
        startDate: string;
        endDate: string;
        status?: "pending" | "paid" | "overdue" | undefined;
        type?: "income" | "expense" | undefined;
        category?: string | undefined;
        priority?: "immediate" | "waiting" | undefined;
        payeeName?: string | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
        overdueOnly?: boolean | undefined;
    }, {
        startDate: string;
        endDate: string;
        status?: "pending" | "paid" | "overdue" | undefined;
        type?: "income" | "expense" | undefined;
        category?: string | undefined;
        priority?: "immediate" | "waiting" | undefined;
        payeeName?: string | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
        overdueOnly?: boolean | undefined;
    }>, {
        count: number;
        totalAmount: number;
        transactions: {
            priority: {} | null;
            documentKind: {} | null;
            docNumber: {} | null;
            payeeName: string | null;
            id: unknown;
            concept: unknown;
            category: unknown;
            amount: unknown;
            type: unknown;
            date: string | null;
            status: unknown;
            notes: {} | null;
            sourceType: {} | null;
        }[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
            status?: "pending" | "paid" | "overdue" | undefined;
            type?: "income" | "expense" | undefined;
            category?: string | undefined;
            priority?: "immediate" | "waiting" | undefined;
            payeeName?: string | undefined;
            documentKind?: "invoice" | "purchase" | undefined;
            overdueOnly?: boolean | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            totalAmount: number;
            transactions: {
                priority: {} | null;
                documentKind: {} | null;
                docNumber: {} | null;
                payeeName: string | null;
                id: unknown;
                concept: unknown;
                category: unknown;
                amount: unknown;
                type: unknown;
                date: string | null;
                status: unknown;
                notes: {} | null;
                sourceType: {} | null;
            }[];
        }>;
    };
    getPendingInvoicesBySupplier: import("ai").Tool<import("zod").ZodObject<{
        limit: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
        documentKind: import("zod").ZodOptional<import("zod").ZodEnum<["invoice", "purchase"]>>;
        payeeName: import("zod").ZodOptional<import("zod").ZodString>;
    }, "strip", import("zod").ZodTypeAny, {
        limit: number;
        payeeName?: string | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
    }, {
        payeeName?: string | undefined;
        documentKind?: "invoice" | "purchase" | undefined;
        limit?: number | undefined;
    }>, {
        documentKind: "invoice" | "purchase";
        supplierCount: number;
        totalInvoices: number;
        totalAmount: number;
        suppliers: {
            supplierName: string;
            count: number;
            total: number;
            oldestDate: string | null;
            immediateCount: number;
            overdueCount: number;
        }[];
    }> & {
        execute: (args: {
            limit: number;
            payeeName?: string | undefined;
            documentKind?: "invoice" | "purchase" | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            documentKind: "invoice" | "purchase";
            supplierCount: number;
            totalInvoices: number;
            totalAmount: number;
            suppliers: {
                supplierName: string;
                count: number;
                total: number;
                oldestDate: string | null;
                immediateCount: number;
                overdueCount: number;
            }[];
        }>;
    };
    getCashFlow: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        openingBalance: number;
        totalIncome: number;
        totalExpenses: number;
        netFlow: number;
        closingBalance: number;
        incomeByCategory: import("./finance-tools.js").CategoryBreakdown[];
        expensesByCategory: import("./finance-tools.js").CategoryBreakdown[];
        pendingIncome: number;
        pendingExpenses: number;
        pendingCount: number;
        transactionCount: number;
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            openingBalance: number;
            totalIncome: number;
            totalExpenses: number;
            netFlow: number;
            closingBalance: number;
            incomeByCategory: import("./finance-tools.js").CategoryBreakdown[];
            expensesByCategory: import("./finance-tools.js").CategoryBreakdown[];
            pendingIncome: number;
            pendingExpenses: number;
            pendingCount: number;
            transactionCount: number;
        }>;
    };
    getIncomeStatement: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        revenue: {
            total: number;
            categories: import("./finance-tools.js").CategoryBreakdown[];
        };
        costOfSales: {
            total: number;
            categories: import("./finance-tools.js").CategoryBreakdown[];
        };
        grossProfit: number;
        grossMarginPercent: number;
        operatingExpenses: {
            total: number;
            categories: import("./finance-tools.js").CategoryBreakdown[];
        };
        operatingProfit: number;
        operatingMarginPercent: number;
        otherIncome: {
            total: number;
            categories: import("./finance-tools.js").CategoryBreakdown[];
        };
        otherExpenses: {
            total: number;
            categories: import("./finance-tools.js").CategoryBreakdown[];
        };
        netProfit: number;
        netMarginPercent: number;
        transactionCount: number;
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            revenue: {
                total: number;
                categories: import("./finance-tools.js").CategoryBreakdown[];
            };
            costOfSales: {
                total: number;
                categories: import("./finance-tools.js").CategoryBreakdown[];
            };
            grossProfit: number;
            grossMarginPercent: number;
            operatingExpenses: {
                total: number;
                categories: import("./finance-tools.js").CategoryBreakdown[];
            };
            operatingProfit: number;
            operatingMarginPercent: number;
            otherIncome: {
                total: number;
                categories: import("./finance-tools.js").CategoryBreakdown[];
            };
            otherExpenses: {
                total: number;
                categories: import("./finance-tools.js").CategoryBreakdown[];
            };
            netProfit: number;
            netMarginPercent: number;
            transactionCount: number;
        }>;
    };
    getBudgetComparison: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        rows: {
            category: string;
            type: string;
            budgeted: number;
            actual: number;
            difference: number;
            executionPercent: number;
        }[];
        totalBudgetedIncome: number;
        totalActualIncome: number;
        totalBudgetedExpenses: number;
        totalActualExpenses: number;
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            rows: {
                category: string;
                type: string;
                budgeted: number;
                actual: number;
                difference: number;
                executionPercent: number;
            }[];
            totalBudgetedIncome: number;
            totalActualIncome: number;
            totalBudgetedExpenses: number;
            totalActualExpenses: number;
        }>;
    };
    getExpensesByCategory: import("ai").Tool<import("zod").ZodObject<{
        startDate: import("zod").ZodString;
        endDate: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        startDate: string;
        endDate: string;
    }, {
        startDate: string;
        endDate: string;
    }>, {
        totalExpenses: number;
        transactionCount: number;
        categories: import("./finance-tools.js").CategoryBreakdown[];
    }> & {
        execute: (args: {
            startDate: string;
            endDate: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            totalExpenses: number;
            transactionCount: number;
            categories: import("./finance-tools.js").CategoryBreakdown[];
        }>;
    };
    getSuppliers: import("ai").Tool<import("zod").ZodObject<{
        category: import("zod").ZodOptional<import("zod").ZodString>;
        status: import("zod").ZodOptional<import("zod").ZodEnum<["active", "expired", "pending"]>>;
    }, "strip", import("zod").ZodTypeAny, {
        status?: "active" | "expired" | "pending" | undefined;
        category?: string | undefined;
    }, {
        status?: "active" | "expired" | "pending" | undefined;
        category?: string | undefined;
    }>, {
        count: number;
        suppliers: {
            id: unknown;
            name: unknown;
            identification: unknown;
            category: unknown;
            contactName: unknown;
            email: unknown;
            phone: unknown;
            contractStart: string | null;
            contractEnd: string | null;
            status: unknown;
        }[];
    }> & {
        execute: (args: {
            status?: "active" | "expired" | "pending" | undefined;
            category?: string | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            suppliers: {
                id: unknown;
                name: unknown;
                identification: unknown;
                category: unknown;
                contactName: unknown;
                email: unknown;
                phone: unknown;
                contractStart: string | null;
                contractEnd: string | null;
                status: unknown;
            }[];
        }>;
    };
    getSupplier: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>, {
        id: unknown;
        name: unknown;
        identification: unknown;
        category: unknown;
        contactName: unknown;
        email: unknown;
        phone: unknown;
        contractStart: string | null;
        contractEnd: string | null;
        status: unknown;
    } | {
        error: string;
    }> & {
        execute: (args: {
            id: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            id: unknown;
            name: unknown;
            identification: unknown;
            category: unknown;
            contactName: unknown;
            email: unknown;
            phone: unknown;
            contractStart: string | null;
            contractEnd: string | null;
            status: unknown;
        } | {
            error: string;
        }>;
    };
    getEmployees: import("ai").Tool<import("zod").ZodObject<{
        department: import("zod").ZodOptional<import("zod").ZodString>;
        status: import("zod").ZodOptional<import("zod").ZodEnum<["active", "inactive"]>>;
    }, "strip", import("zod").ZodTypeAny, {
        department?: string | undefined;
        status?: "active" | "inactive" | undefined;
    }, {
        department?: string | undefined;
        status?: "active" | "inactive" | undefined;
    }>, {
        count: number;
        employees: {
            id: unknown;
            name: unknown;
            identification: unknown;
            role: unknown;
            department: unknown;
            email: unknown;
            phone: unknown;
            salary: unknown;
            startDate: string | null;
            status: unknown;
        }[];
    }> & {
        execute: (args: {
            department?: string | undefined;
            status?: "active" | "inactive" | undefined;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            employees: {
                id: unknown;
                name: unknown;
                identification: unknown;
                role: unknown;
                department: unknown;
                email: unknown;
                phone: unknown;
                salary: unknown;
                startDate: string | null;
                status: unknown;
            }[];
        }>;
    };
    getEmployee: import("ai").Tool<import("zod").ZodObject<{
        id: import("zod").ZodString;
    }, "strip", import("zod").ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>, {
        id: unknown;
        name: unknown;
        identification: unknown;
        role: unknown;
        department: unknown;
        email: unknown;
        phone: unknown;
        salary: unknown;
        startDate: string | null;
        status: unknown;
    } | {
        error: string;
    }> & {
        execute: (args: {
            id: string;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            id: unknown;
            name: unknown;
            identification: unknown;
            role: unknown;
            department: unknown;
            email: unknown;
            phone: unknown;
            salary: unknown;
            startDate: string | null;
            status: unknown;
        } | {
            error: string;
        }>;
    };
};
//# sourceMappingURL=index.d.ts.map