import { z } from 'zod';
export declare function createDailyClosingTools(companyId: string): {
    getDailyClosings: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
    }, "strip", z.ZodTypeAny, {
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
    getDailyClosing: import("ai").Tool<z.ZodObject<{
        date: z.ZodString;
    }, "strip", z.ZodTypeAny, {
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
    getDiscountsReport: import("ai").Tool<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
        reason: z.ZodOptional<z.ZodEnum<["Empleado", "Influencer", "Socio", "Prueba de calidad", "Otro"]>>;
    }, "strip", z.ZodTypeAny, {
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
    getTipsSummary: import("ai").Tool<z.ZodObject<{
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
    createDailyClosing: import("ai").Tool<z.ZodObject<{
        date: z.ZodString;
        ap: z.ZodNumber;
        qr: z.ZodNumber;
        datafono: z.ZodNumber;
        rappiVentas: z.ZodNumber;
        efectivo: z.ZodNumber;
        propinas: z.ZodNumber;
        gastos: z.ZodNumber;
        cajaMenor: z.ZodNumber;
        entregaEfectivo: z.ZodNumber;
        responsable: z.ZodString;
    }, "strip", z.ZodTypeAny, {
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
};
//# sourceMappingURL=daily-closing-tools.d.ts.map