export type CallbackStateKind = 'payFlow' | 'quickEntry';
export interface CallbackState<P = unknown> {
    stateId: string;
    chatId: number;
    uid: string;
    companyId: string;
    kind: CallbackStateKind;
    payload: P;
    messageId?: number;
    status: 'active' | 'consumed';
}
export declare function saveCallbackState(data: {
    chatId: number;
    uid: string;
    companyId: string;
    kind: CallbackStateKind;
    payload: unknown;
    messageId?: number;
}): Promise<string>;
/**
 * Carga el estado si sigue vigente (no expirado) y pertenece a este chat.
 * Devuelve null si no existe, expiró o el chatId no coincide (defensa contra
 * callback_data de otro chat).
 */
export declare function loadCallbackState<P = unknown>(stateId: string, chatId: number): Promise<CallbackState<P> | null>;
export declare function patchCallbackState(stateId: string, patch: {
    payload?: unknown;
    messageId?: number;
    status?: 'active' | 'consumed';
}): Promise<void>;
//# sourceMappingURL=callback-state.d.ts.map