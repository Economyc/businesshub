import { z } from 'zod';
export declare function createCollectionsTools(companyId: string): {
    getOverdueCollections: import("ai").Tool<z.ZodObject<{
        minDaysOverdue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
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
};
//# sourceMappingURL=collections-tools.d.ts.map