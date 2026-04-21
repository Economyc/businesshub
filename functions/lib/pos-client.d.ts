export declare const POS_BASE_URL = "http://api.restaurant.pe/restaurant";
export declare const BATCH_DELAY_MS = 5000;
export declare const MAX_RETRIES = 3;
export interface PosApiResponse {
    tipo: number | string;
    data: Record<string, unknown> | unknown[];
    mensajes: string[];
}
export interface PosLocalRaw {
    local_id: string | number;
    local_descripcion: string;
    [key: string]: unknown;
}
export interface PosDominioResult {
    locales: PosLocalRaw[];
    [key: string]: unknown;
}
export declare function buildUrl(path: string, token: string): string;
export declare function delay(ms: number): Promise<void>;
export declare function fetchPosApi(url: string, method?: 'GET' | 'POST', body?: unknown): Promise<unknown>;
export declare function isRateLimited(response: PosApiResponse): boolean;
export declare function extractVentas(response: PosApiResponse): unknown[];
export declare function fetchDominio(token: string, domainId: string): Promise<PosDominioResult>;
export interface FetchAllPagesResult {
    ventas: unknown[];
    rateLimited: boolean;
    requestCount: number;
}
export declare function fetchAllPagesForLocal(token: string, domainId: string, localId: number, f1: string, f2: string): Promise<FetchAllPagesResult>;
export declare function fetchCatalogo(token: string, domainId: string, localId: number): Promise<unknown[]>;
//# sourceMappingURL=pos-client.d.ts.map