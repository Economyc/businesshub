export interface UploadEmployeeDocInput {
    companyId: string;
    employeeName: string;
    identification: string;
    /** Etiqueta humana del tipo de documento, ej. "Cédula", "Contrato". */
    docTypeLabel: string;
    fileBase64: string;
    fileName: string;
    mimeType: string;
}
export declare const uploadEmployeeDocumentToDrive: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    driveFileId: string;
    webViewLink: string;
    fileName: string;
}>, unknown>;
//# sourceMappingURL=upload-employee-document-to-drive.d.ts.map