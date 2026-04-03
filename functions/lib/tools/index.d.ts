export declare function createAgentTools(companyId: string): {
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
    }, "strip", import("zod").ZodTypeAny, {
        status: "pending" | "paid";
        type: "income" | "expense";
        date: string;
        category: string;
        concept: string;
        amount: number;
        notes?: string | undefined;
    }, {
        type: "income" | "expense";
        date: string;
        category: string;
        concept: string;
        amount: number;
        status?: "pending" | "paid" | undefined;
        notes?: string | undefined;
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
    analyzeSupplierPrices: import("ai").Tool<import("zod").ZodObject<{
        months: import("zod").ZodDefault<import("zod").ZodOptional<import("zod").ZodNumber>>;
    }, "strip", import("zod").ZodTypeAny, {
        months: number;
    }, {
        months?: number | undefined;
    }>, {
        periodMonths: number;
        totalPurchases: number;
        totalSpent: number;
        supplierBreakdown: {
            supplierId: string;
            supplierName: string;
            purchaseCount: number;
            totalSpent: number;
            averagePerPurchase: number;
        }[];
    }> & {
        execute: (args: {
            months: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            periodMonths: number;
            totalPurchases: number;
            totalSpent: number;
            supplierBreakdown: {
                supplierId: string;
                supplierName: string;
                purchaseCount: number;
                totalSpent: number;
                averagePerPurchase: number;
            }[];
        }>;
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
    }, "strip", import("zod").ZodTypeAny, {
        startDate: string;
        endDate: string;
        status?: "pending" | "paid" | "overdue" | undefined;
        type?: "income" | "expense" | undefined;
        category?: string | undefined;
    }, {
        startDate: string;
        endDate: string;
        status?: "pending" | "paid" | "overdue" | undefined;
        type?: "income" | "expense" | undefined;
        category?: string | undefined;
    }>, {
        count: number;
        totalAmount: number;
        transactions: {
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
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            count: number;
            totalAmount: number;
            transactions: {
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