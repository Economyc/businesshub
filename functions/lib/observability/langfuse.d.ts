import { Langfuse } from 'langfuse';
export declare function getLangfuseClient(): Langfuse | null;
/** Best-effort flush; tolerates SDK API differences (flushAsync vs flush vs shutdownAsync). */
export declare function flushLangfuse(client: Langfuse | null | undefined): Promise<void>;
//# sourceMappingURL=langfuse.d.ts.map