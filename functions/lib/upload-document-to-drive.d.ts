import { type DocType } from './utils/doc-naming.js';
export interface UploadInput {
    companyId: string;
    docType: DocType;
    supplierName: string;
    docNumber: string;
    date: string | number;
    fileBase64: string;
    fileName: string;
    mimeType: string;
}
export declare function uploadCompanyDocument(actorUid: string, data: UploadInput): Promise<{
    driveFileId: string;
    webViewLink: string;
    fileName: string;
}>;
export declare const uploadDocumentToDrive: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    driveFileId: string;
    webViewLink: string;
    fileName: string;
}>, unknown>;
export declare const validateDriveFolder: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    ok: true;
    folderName: string;
} | {
    ok: false;
    error: string;
}>, unknown>;
export declare const driveAuthStart: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    url: string;
}>, unknown>;
export declare const driveAuthDisconnect: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    ok: boolean;
}>, unknown>;
export declare const driveAuthStatus: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    connected: boolean;
    email: string | null;
    connectedAt: number | null;
}>, unknown>;
export declare const driveOAuthCallback: import("firebase-functions/v2/https").HttpsFunction;
//# sourceMappingURL=upload-document-to-drive.d.ts.map