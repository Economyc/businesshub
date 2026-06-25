// Handler del selector de fecha (namespace dp:), compartido por pay-flow y
// quick-entry. La fecha elegida se enruta a la continuación del flujo según el
// kind guardado en telegramCallbackState.
//   dp:noop                       — botones decorativos del calendario
//   dp:nav:<stateId>:<YYYY-MM>    — cambiar de mes (re-render del teclado)
//   dp:set:<stateId>:<YYYY-MM-DD> — fecha elegida → continúa el flujo
import { loadCallbackState } from './callback-state.js';
import { buildDatePicker } from './menus.js';
import { continuePayFlowAfterDate } from './pay-flow.js';
import { continueQuickEntryAfterDate } from './quick-entry.js';
export function registerDatePicker(router) {
    router.register('dp', async (ctx, args, deps) => {
        const action = args[0];
        const { chatId } = deps;
        if (action === 'noop')
            return;
        if (action === 'nav') {
            const stateId = args[1];
            const [y, m] = (args[2] ?? '').split('-').map(Number);
            if (!y || !m)
                return;
            await ctx.editMessageReplyMarkup({ reply_markup: buildDatePicker(stateId, y, m) }).catch(() => { });
            return;
        }
        if (action === 'set') {
            const stateId = args[1];
            const dateIso = args[2];
            const state = await loadCallbackState(stateId, chatId);
            if (!state) {
                await ctx.editMessageText('⌛ Este menú expiró. Escribe /menu para empezar de nuevo.').catch(() => { });
                return;
            }
            if (state.kind === 'payFlow') {
                await continuePayFlowAfterDate(ctx, deps, state, dateIso);
            }
            else if (state.kind === 'quickEntry') {
                await continueQuickEntryAfterDate(ctx, deps, state, dateIso);
            }
        }
    });
}
//# sourceMappingURL=date-picker.js.map