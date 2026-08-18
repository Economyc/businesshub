export type UsageField = 'cloudVisionOcr' | 'geminiExtractions' | 'groqScoutExtractions' | 'cerebrasTextExtractions' | 'groqLlama70bExtractions' | 'totalExtractions' | 'totalFailed';
export interface UsageSnapshot {
    monthKey: string;
    monthLabel: string;
    cloudVisionOcrUsed: number;
    cloudVisionFreeMonthly: number;
    cloudVisionRemaining: number;
    cloudVisionOverFreeTier: boolean;
    /**
     * Claves heredadas de los modelos originales. Se conservan tal cual porque el
     * histórico mensual y los clientes (App1/Ecore) las leen así; hoy 'groq-scout'
     * cuenta a groq-qwen y 'groq-llama70b' a groq-gptoss.
     */
    byProvider: {
        gemini: number;
        'groq-scout': number;
        'cerebras-llama8b': number;
        'groq-llama70b': number;
    };
    totalExtractions: number;
    totalFailed: number;
}
export declare function currentMonthKey(now?: Date): string;
export declare function currentMonthLabel(now?: Date): string;
/**
 * Mapeo provider de LLMRouter → campo del doc. Devuelve null si el provider
 * no tiene contador propio (no debería pasar en runtime).
 */
export declare function providerToField(provider: string): UsageField | null;
/**
 * Incrementa un contador del mes actual. Fire-and-forget: si Firestore falla
 * solo se logea, no se propaga el error. Nunca debe romper la extracción.
 */
export declare function recordUsage(field: UsageField, by?: number): Promise<void>;
/**
 * Lee el snapshot del mes actual. Si el doc no existe, devuelve ceros.
 * Lanza solo si Firestore tira un error transitorio — el caller decide
 * (típicamente seguimos devolviendo la respuesta sin `usage`).
 */
export declare function getUsageSnapshot(): Promise<UsageSnapshot>;
//# sourceMappingURL=ai-usage-stats.d.ts.map