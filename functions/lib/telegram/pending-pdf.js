// PDF de pagos pendientes bajo demanda (botón 📄 o comando /pendientes). Reusa
// el mismo generador del cron de las 08:30, pero con datos EN CALIENTE.
import { InputFile } from 'grammy';
import { loadUserCompanies } from './auth.js';
import { buildPendingPaymentsPdf, } from '../utils/build-pending-payments-pdf.js';
import { buildCompanySection, buildCaption, bogotaLabel } from '../utils/pending-payments-core.js';
export async function sendPendingPaymentsPdf(ctx, deps) {
    const companies = await loadUserCompanies(deps.uid);
    if (companies.length === 0) {
        await ctx.reply('Tu usuario no tiene empresas activas.');
        return;
    }
    const sections = [];
    for (const c of companies) {
        const section = await buildCompanySection(c.id, c.name);
        if (section)
            sections.push(section);
    }
    const dateLabel = bogotaLabel(new Date());
    if (sections.length === 0) {
        await ctx.reply(`✅ Sin pagos pendientes — ${dateLabel}`);
        return;
    }
    sections.sort((a, b) => b.companyTotal - a.companyTotal);
    const report = {
        dateLabel,
        companies: sections,
        grandTotal: sections.reduce((s, c) => s + c.companyTotal, 0),
    };
    const pdf = await buildPendingPaymentsPdf(report);
    const safeDate = dateLabel.replace(/[^\d]/g, '') || 'hoy';
    await ctx.replyWithDocument(new InputFile(pdf, `pendientes-${safeDate}.pdf`), {
        caption: buildCaption(report),
        parse_mode: 'HTML',
    });
}
export function registerPendingPdf(router) {
    router.register('pp', async (ctx, args, deps) => {
        if (args[0] !== 'now')
            return;
        await sendPendingPaymentsPdf(ctx, deps);
    });
}
//# sourceMappingURL=pending-pdf.js.map