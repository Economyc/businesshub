export type DeliveryChannel = 'email' | 'whatsapp' | 'firestore';
export interface DeliverReportInput {
    companyId: string;
    scheduledReportId: string;
    reportType: string;
    channel: DeliveryChannel;
    recipient: string;
    subject: string;
    htmlBody: string;
    textBody: string;
}
export interface DeliveryResult {
    ok: boolean;
    channelUsed: DeliveryChannel;
    fellBack: boolean;
    reason?: string;
    sentReportId?: string;
}
export declare function deliverReport(input: DeliverReportInput): Promise<DeliveryResult>;
//# sourceMappingURL=report-delivery.d.ts.map