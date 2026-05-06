export interface ProgressStep {
    label: string;
    status?: 'running' | 'done' | 'error';
}
/**
 * Reporta un paso de progreso para un toolCallId. Se diseñó para ser
 * fire-and-forget: el caller debe usar `void reportProgress(...)` para no
 * bloquear el camino crítico de la tool. Errores se loguean y no se
 * propagan (la tool tiene que terminar igual).
 *
 * `expireAt` se actualiza en cada write (24h en el futuro). Combinado con la
 * TTL policy de Firestore sobre el campo `expireAt`, los docs se borran
 * automáticamente 24h después de la última actividad.
 */
export declare function reportProgress(toolCallId: string | undefined, step: ProgressStep): Promise<void>;
//# sourceMappingURL=tool-progress.d.ts.map