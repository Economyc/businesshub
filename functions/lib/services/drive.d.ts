export declare function getServiceAccountEmail(): Promise<string | null>;
export declare function ensureFolderPath(companyId: string, rootFolderId: string, segments: string[]): Promise<string>;
export interface UploadResult {
    driveFileId: string;
    webViewLink: string;
    fileName: string;
}
export declare function uploadFile(parentFolderId: string, fileName: string, mimeType: string, fileBase64: string): Promise<UploadResult>;
export declare function validateRootFolderAccess(rootFolderId: string): Promise<{
    ok: true;
    folderName: string;
} | {
    ok: false;
    error: string;
}>;
//# sourceMappingURL=drive.d.ts.map