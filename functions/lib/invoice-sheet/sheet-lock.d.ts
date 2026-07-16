import { type DocumentReference } from 'firebase-admin/firestore';
export type SheetJobClaim = {
    claimed: true;
    ref: DocumentReference;
} | {
    claimed: false;
};
export declare function sheetJobRef(companyId: string, year: number, monthIndex: number): DocumentReference;
/** Identifica al titular del lock en los logs. Sin valor funcional. */
export declare function newLockOwner(tag: string): string;
/**
 * Intenta tomar el lock del mes. Si otro proceso lo tiene, NO escribe nada y
 * devuelve `{claimed:false}` — el caller decide (el callable responde `queued`,
 * el cron se salta el job hasta el próximo ciclo).
 *
 * `{merge:true}` es obligatorio: el callable puede pedir un mes que nunca tuvo
 * doc `sheet-jobs` (generación manual de un mes viejo, sin escrituras).
 */
export declare function claimSheetJob(companyId: string, year: number, monthIndex: number, owner: string): Promise<SheetJobClaim>;
/**
 * Libera el lock. Va SIEMPRE en un `finally`, y nunca escribe `dirty`: si la
 * regeneración falló y el caller re-marcó dirty para reintentar, el release no
 * debe pisarlo. Si falla, el TTL cubre.
 */
export declare function releaseSheetJob(ref: DocumentReference): Promise<void>;
/** Marca el mes como pendiente de regenerar en el próximo ciclo del cron. */
export declare function markSheetJobDirty(companyId: string, year: number, monthIndex: number): Promise<void>;
//# sourceMappingURL=sheet-lock.d.ts.map