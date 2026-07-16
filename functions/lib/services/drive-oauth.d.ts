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
interface UserDriveAuth {
    refreshToken: string;
    email: string | null;
    connectedAt: number;
}
/**
 * El token vive a nivel usuario (no por empresa). Una vez que el usuario
 * conecta su Drive, lo usa para todas las empresas a las que tiene acceso.
 * Los archivos van a la carpeta `driveRootFolderId` que la empresa tenga
 * configurada (esa sí es por-empresa).
 */
export declare function saveDriveAuth(uid: string, data: ExchangeResult): Promise<void>;
export declare function clearDriveAuth(uid: string): Promise<void>;
export declare function getUserDriveAuth(uid: string): Promise<UserDriveAuth | null>;
/**
 * Error tipado: el refresh token del dueño de Drive caducó o fue revocado
 * (Google responde `invalid_grant` al renovarlo). Apps OAuth en estado
 * "Testing" expiran el refresh token a los 7 días — de ahí que esto reaparezca
 * periódicamente hasta publicar la pantalla de consentimiento.
 */
export declare class DriveTokenExpiredError extends Error {
    constructor();
}
/**
 * Error tipado: el token es válido pero NO trae el scope de Drive. Pasa cuando
 * el usuario reconecta y no marca la casilla de permiso de Drive en la pantalla
 * de consentimiento de Google (consent granular). La subida llega autenticada
 * pero sin permiso → "Request had insufficient authentication scopes".
 */
export declare class DriveScopeError extends Error {
    constructor();
}
/** Detecta el `invalid_grant` venga como venga (GaxiosError, message, code). */
export declare function isInvalidGrant(err: unknown): boolean;
/** Detecta el caso "token sin scope de Drive" (403 / insufficient scopes). */
export declare function isInsufficientScope(err: unknown): boolean;
/**
 * Error tipado: se agotó el presupuesto de tiempo antes de conseguir que Drive
 * respondiera. El caller lo traduce a "encolado" en vez de a un fallo duro — el
 * cron regenerará la hoja. Existe para NUNCA llegar al timeout del contenedor:
 * un 504 lo genera la infra de Cloud Run sin header CORS, y el navegador lo
 * reporta como un error de CORS que despista (bug de prod 2026-07-16).
 */
export declare class DriveBudgetExceededError extends Error {
    constructor();
}
export interface DriveOpts {
    /** Epoch ms. Al pasarse, se lanza DriveBudgetExceededError en vez de reintentar. */
    deadlineAt?: number;
    /** Timeout de cada request a Drive. */
    attemptTimeoutMs?: number;
    maxAttempts?: number;
}
/** Opciones de gaxios por request: sin retry interno (ver withDriveRetry) + timeout. */
export declare function driveReqOpts(opts: DriveOpts | undefined, capMs?: number): {
    retry: boolean;
    timeout: number;
};
/**
 * ¿Merece la pena reintentar este error de Drive? Solo fallos transitorios.
 *
 * Contexto: gaxios NO reintenta nada de esto por su cuenta — su
 * `httpMethodsToRetry` por defecto es GET/HEAD/PUT/OPTIONS/DELETE, y el upload
 * de la hoja es PATCH (files.update) o POST (files.create). O sea que hasta
 * ahora un 500 de Drive moría al primer intento.
 */
export declare function isRetryableDriveError(err: unknown): boolean;
/**
 * Reintenta `fn` con backoff exponencial ante fallos transitorios de Drive.
 *
 * `fn` DEBE ser idempotente y auto-contenida: se la envuelve entera (p. ej.
 * list → update|create), no llamada a llamada. Motivos:
 *  - Reintentar un `files.create` suelto tras un 500 puede DUPLICAR el archivo
 *    (el 500 puede llegar con el archivo ya creado). Al re-ejecutar el bloque
 *    completo, el `list` encuentra lo que dejó el intento fallido y toma `update`.
 *  - El body del upload es un `Readable`, que se consume: cada intento tiene que
 *    reconstruirlo. Metiendo el stream dentro de `fn` sale gratis.
 *
 * Va DENTRO de runDrive: los errores de auth salen intactos al primer intento y
 * runDrive los traduce como siempre.
 */
export declare function withDriveRetry<T>(fn: () => Promise<T>, opts?: DriveOpts): Promise<T>;
/**
 * Resuelve qué uid de Drive usar para las operaciones de una empresa.
 *
 * 1. Si la empresa tiene `driveOwnerUid` explícito → ese (override manual).
 * 2. Si no, el primer miembro con rol `owner` y status `active`.
 * 3. Si no hay owner activo, cae al `fallbackUid` (el del request) — comportamiento legacy.
 */
export declare function resolveDriveUid(companyId: string, fallbackUid: string): Promise<string>;
/**
 * Devuelve un cliente de Drive autenticado con el refresh token del usuario.
 * Lanza error si no hay token configurado.
 */
export declare function getDriveForUser(uid: string): Promise<drive_v3.Drive>;
export declare function ensureFolderPath(uid: string, companyId: string, rootFolderId: string, segments: string[], opts?: DriveOpts): Promise<string>;
export interface UploadResult {
    driveFileId: string;
    webViewLink: string;
    fileName: string;
}
export declare function uploadFile(uid: string, parentFolderId: string, fileName: string, mimeType: string, fileBase64: string): Promise<UploadResult>;
/**
 * Sube un archivo y, si ya existe uno con el mismo nombre en la carpeta, lo
 * reemplaza en vez de duplicar. Pensado para la hoja de seguimiento mensual:
 * cada mes hay un único archivo que se sobreescribe al regenerarlo.
 *
 * `convertToMimeType` hace que Drive convierta el contenido subido a un tipo
 * nativo de Google (p. ej. .xlsx → Google Sheet) usando SOLO el scope de Drive,
 * sin necesidad del scope de Sheets. Al actualizar un archivo que ya es nativo
 * de Google, subir media .xlsx reemplaza su contenido y Drive lo re-convierte.
 */
export declare function uploadOrReplaceFile(uid: string, parentFolderId: string, fileName: string, mediaMimeType: string, fileBase64: string, convertToMimeType?: string, opts?: DriveOpts): Promise<UploadResult>;
/**
 * Borra un archivo de Drive por id. Idempotente: si el archivo ya no existe
 * (404), devuelve `notFound: true` sin lanzar — el caller lo trata como éxito.
 * Cualquier otro error de Drive sí se propaga (incluyendo invalid_grant y
 * insufficient scopes, que se traducen vía runDrive a los errores tipados).
 */
export declare function deleteDriveFile(uid: string, fileId: string): Promise<{
    deleted: boolean;
    notFound: boolean;
}>;
/**
 * Descarga un archivo de Drive y devuelve sus bytes + mimeType. Usado para
 * recuperar la factura y el comprobante ya subidos y fusionarlos en un PDF.
 */
export declare function downloadFile(uid: string, fileId: string): Promise<{
    buffer: Buffer;
    mimeType: string;
}>;
/**
 * Mueve un archivo de Drive a otra carpeta (posiblemente de otra empresa).
 *
 *  - **Mismo dueño de Drive** (`uidFrom === uidTo`, caso típico Blue↔Blue):
 *    reparent con `addParents`/`removeParents`. Conserva `driveFileId` y
 *    `webViewLink` — el `PayableFile` no cambia.
 *  - **Dueños distintos:** no se puede reparentar entre cuentas, así que se
 *    descarga del Drive origen, se sube al destino y se borra el original.
 *    Genera un `driveFileId`/`webViewLink` NUEVOS — el caller debe persistirlos.
 *
 * Devuelve los datos (quizá nuevos) del archivo ya en destino.
 */
export declare function moveDriveFile(uidFrom: string, uidTo: string, fileId: string, targetFolderId: string, fileName: string): Promise<{
    sameAccount: boolean;
    driveFileId: string;
    webViewLink: string;
    fileName: string;
}>;
export declare function validateRootFolderAccess(uid: string, rootFolderId: string): Promise<{
    ok: true;
    folderName: string;
} | {
    ok: false;
    error: string;
}>;
export {};
//# sourceMappingURL=drive-oauth.d.ts.map