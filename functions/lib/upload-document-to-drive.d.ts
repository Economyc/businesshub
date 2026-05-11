export declare const uploadDocumentToDrive: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    driveFileId: string;
    webViewLink: string;
    fileName: string;
}>, unknown>;
export declare const validateDriveFolder: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    serviceAccountEmail: string | null;
    ok: true;
    folderName: string;
} | {
    serviceAccountEmail: string | null;
    ok: false;
    error: string;
}>, unknown>;
export declare const getDriveServiceAccount: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    email: string | null;
}>, unknown>;
//# sourceMappingURL=upload-document-to-drive.d.ts.map