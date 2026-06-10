export declare class TelegramFileError extends Error {
}
export interface DownloadedFile {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
}
export declare function downloadTelegramFile(botToken: string, fileId: string, opts: {
    fileName?: string;
    mimeType: string;
}): Promise<DownloadedFile>;
//# sourceMappingURL=files.d.ts.map