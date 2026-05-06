import { z } from 'zod';
export interface Alert {
    type: 'warning' | 'danger' | 'info';
    category: string;
    message: string;
    details?: Record<string, unknown>;
}
export declare function createAlertsTools(companyId: string): {
    getBusinessAlerts: import("ai").Tool<z.ZodObject<{
        daysAhead: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        daysAhead: number;
    }, {
        daysAhead?: number | undefined;
    }>, {
        totalAlerts: number;
        dangerCount: number;
        warningCount: number;
        infoCount: number;
        alerts: Alert[];
    }> & {
        execute: (args: {
            daysAhead: number;
        }, options: import("ai").ToolExecutionOptions) => PromiseLike<{
            totalAlerts: number;
            dangerCount: number;
            warningCount: number;
            infoCount: number;
            alerts: Alert[];
        }>;
    };
};
//# sourceMappingURL=alerts-tools.d.ts.map