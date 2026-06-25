// Selector de empresa por botones (multi-tenant). Reemplaza/complementa el
// "/empresa <nombre>" por texto. callback: co:set:<companyId> (el id de Firestore
// cabe en 64 bytes → sin telegramCallbackState).
import { InlineKeyboard } from 'grammy';
import { loadUserCompanies } from './auth.js';
import { loadChatState, updateChatState } from './history.js';
import { backToMenuKeyboard } from './menus.js';
/** Construye el texto + teclado del selector (la activa marcada con ▶️). */
export async function buildCompanySelector(uid, chatId) {
    const [companies, state] = await Promise.all([loadUserCompanies(uid), loadChatState(chatId)]);
    if (companies.length === 0)
        return null;
    const kb = new InlineKeyboard();
    for (const c of companies) {
        const active = c.id === state.activeCompanyId;
        const label = `${active ? '▶️ ' : ''}${c.name}${c.location ? ` (${c.location})` : ''}`;
        kb.text(label, `co:set:${c.id}`).row();
    }
    return { text: '🏢 Elige el local activo:', keyboard: backToMenuKeyboard(kb) };
}
export function registerCompanySelect(router) {
    // co:set:<companyId>
    router.register('co', async (ctx, args, deps) => {
        if (args[0] !== 'set')
            return;
        const companyId = args[1];
        const { uid, chatId } = deps;
        // Re-validar membresía: nunca confiar en el id que viene del cliente.
        const companies = await loadUserCompanies(uid);
        const company = companies.find((c) => c.id === companyId);
        if (!company) {
            await ctx.editMessageText('⚠️ Ese local ya no está disponible para tu usuario.').catch(() => { });
            return;
        }
        await updateChatState(chatId, {
            activeCompanyId: company.id,
            activeCompanyName: company.name,
        });
        const selector = await buildCompanySelector(uid, chatId);
        const suffix = `\n\n✅ Local activo: ${company.name}${company.location ? ` (${company.location})` : ''}`;
        if (selector) {
            await ctx.editMessageText(selector.text + suffix, { reply_markup: selector.keyboard }).catch(() => { });
        }
        else {
            await ctx.editMessageText(suffix.trim()).catch(() => { });
        }
    });
}
//# sourceMappingURL=company-select.js.map