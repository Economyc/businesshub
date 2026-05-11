import { drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
export declare const driveClientId: import("firebase-functions/params").SecretParam;
export declare const driveClientSecret: import("firebase-functions/params").SecretParam;
/**
 * URI de callback registrada en el OAuth Client de GCP. Apunta al endpoint
 * `driveOAuthCallback` de Cloud Functions, no al frontend (porque la app
 * vive en HTTP y Google solo acepta HTTPS para redirect_uri).
 */
export declare function getRedirectUri(): string;
export declare function createOAuthClient(): OAuth2Client;
export declare function buildAuthUrl(state: string): string;
export interface ExchangeResult {
    refreshToken: string;
    accessToken: string;
    expiryDate: number | null;
    email: string | null;
}
export declare function exchangeCodeForTokens(code: string): Promise<ExchangeResult>;
interface CompanyDriveAuth {
    refreshToken: string;
    email: string | null;
    connectedAt: number;
}
export declare function saveDriveAuth(companyId: string, data: ExchangeResult): Promise<void>;
export declare function clearDriveAuth(companyId: string): Promise<void>;
export declare function getCompanyDriveAuth(companyId: string): Promise<CompanyDriveAuth | null>;
/**
 * Devuelve un cliente de Drive autenticado con el refresh token de la
 * empresa. Lanza error si no hay token configurado.
 */
export declare function getDriveForCompany(companyId: string): Promise<drive_v3.Drive>;
export declare function ensureFolderPath(companyId: string, rootFolderId: string, segments: string[]): Promise<string>;
export interface UploadResult {
    driveFileId: string;
    webViewLink: string;
    fileName: string;
}
export declare function uploadFile(companyId: string, parentFolderId: string, fileName: string, mimeType: string, fileBase64: string): Promise<UploadResult>;
export declare function validateRootFolderAccess(companyId: string, rootFolderId: string): Promise<{
    ok: true;
    folderName: string;
} | {
    ok: false;
    error: string;
}>;
export {};
//# sourceMappingURL=drive-oauth.d.ts.map