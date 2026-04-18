import { tool } from 'ai';
import { z } from 'zod';
import { fetchCollection } from '../firestore.js';
// Cierres usan campo `date` como string YYYY-MM-DD.
function inRange(dateStr, start, end) {
    if (!dateStr)
        return false;
    return dateStr >= start && dateStr <= end;
}
function formatClosing(c) {
    const ap = Number(c.ap) || 0;
    const qr = Number(c.qr) || 0;
    const datafono = Number(c.datafono) || 0;
    const rappiVentas = Number(c.rappiVentas) || 0;
    const efectivo = Number(c.efectivo) || 0;
    const propinas = Number(c.propinas) || 0;
    const gastos = Number(c.gastos) || 0;
    const ventaTotal = Number(c.ventaTotal) || ap + qr + datafono + rappiVentas + efectivo;
    return {
        id: c.id,
        date: c.date,
        ap,
        qr,
        datafono,
        rappiVentas,
        efectivo,
        ventaTotal,
        propinas,
        gastos,
        cajaMenor: Number(c.cajaMenor) || 0,
        entregaEfectivo: Number(c.entregaEfectivo) || 0,
        responsable: c.responsable,
    };
}
export function createDailyClosingTools(companyId) {
    return {
        getDailyClosings: tool({
            description: 'Lista los cierres de caja diarios en un rango de fechas. Cada cierre incluye venta por método de pago (AP, QR, datáfono, Rappi, efectivo), propinas y gastos del día.',
            parameters: z.object({
                startDate: z.string().describe('Fecha inicio (YYYY-MM-DD)'),
                endDate: z.string().describe('Fecha fin (YYYY-MM-DD)'),
            }),
            execute: async ({ startDate, endDate }) => {
                const all = await fetchCollection(companyId, 'closings');
                const filtered = all
                    .filter((c) => inRange(c.date, startDate, endDate))
                    .map(formatClosing)
                    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
                const totals = filtered.reduce((acc, c) => {
                    acc.ap += c.ap;
                    acc.qr += c.qr;
                    acc.datafono += c.datafono;
                    acc.rappiVentas += c.rappiVentas;
                    acc.efectivo += c.efectivo;
                    acc.ventaTotal += c.ventaTotal;
                    acc.propinas += c.propinas;
                    acc.gastos += c.gastos;
                    return acc;
                }, { ap: 0, qr: 0, datafono: 0, rappiVentas: 0, efectivo: 0, ventaTotal: 0, propinas: 0, gastos: 0 });
                return {
                    count: filtered.length,
                    dateRange: { startDate, endDate },
                    totals,
                    closings: filtered,
                };
            },
        }),
        getDailyClosing: tool({
            description: 'Detalle de un cierre diario específico por fecha.',
            parameters: z.object({
                date: z.string().describe('Fecha del cierre (YYYY-MM-DD)'),
            }),
            execute: async ({ date }) => {
                const all = await fetchCollection(companyId, 'closings');
                const closing = all.find((c) => c.date === date);
                if (!closing) {
                    return { found: false, date, message: `No hay cierre registrado para ${date}` };
                }
                return { found: true, closing: formatClosing(closing) };
            },
        }),
        getDiscountsReport: tool({
            description: 'Reporte de descuentos aplicados en un rango. Descuentos pueden ser de tipo parcial o total, con razones: Empleado, Influencer, Socio, Prueba de calidad, Otro.',
            parameters: z.object({
                startDate: z.string().describe('Fecha inicio (YYYY-MM-DD)'),
                endDate: z.string().describe('Fecha fin (YYYY-MM-DD)'),
                reason: z
                    .enum(['Empleado', 'Influencer', 'Socio', 'Prueba de calidad', 'Otro'])
                    .optional()
                    .describe('Filtrar por razón del descuento'),
            }),
            execute: async ({ startDate, endDate, reason }) => {
                const all = await fetchCollection(companyId, 'discounts');
                let filtered = all.filter((d) => inRange(d.date, startDate, endDate));
                if (reason)
                    filtered = filtered.filter((d) => d.reason === reason);
                const totalAmount = filtered.reduce((s, d) => s + (Number(d.amount) || 0), 0);
                const byReason = filtered.reduce((acc, d) => {
                    const key = String(d.reason ?? 'Otro');
                    if (!acc[key])
                        acc[key] = { count: 0, amount: 0 };
                    acc[key].count += 1;
                    acc[key].amount += Number(d.amount) || 0;
                    return acc;
                }, {});
                return {
                    count: filtered.length,
                    totalAmount,
                    dateRange: { startDate, endDate },
                    byReason,
                    discounts: filtered.map((d) => ({
                        id: d.id,
                        date: d.date,
                        type: d.type,
                        amount: Number(d.amount) || 0,
                        reason: d.reason,
                        description: d.description,
                        authorizedBy: d.authorizedBy,
                    })),
                };
            },
        }),
        getTipsSummary: tool({
            description: 'Resumen de propinas en un rango: total, promedio diario y detalle por día.',
            parameters: z.object({
                startDate: z.string().describe('Fecha inicio (YYYY-MM-DD)'),
                endDate: z.string().describe('Fecha fin (YYYY-MM-DD)'),
            }),
            execute: async ({ startDate, endDate }) => {
                const all = await fetchCollection(companyId, 'closings');
                const filtered = all.filter((c) => inRange(c.date, startDate, endDate));
                const totalTips = filtered.reduce((s, c) => s + (Number(c.propinas) || 0), 0);
                const avgDaily = filtered.length > 0 ? totalTips / filtered.length : 0;
                const byDay = filtered
                    .map((c) => ({ date: c.date, tips: Number(c.propinas) || 0 }))
                    .sort((a, b) => a.date.localeCompare(b.date));
                return {
                    dateRange: { startDate, endDate },
                    daysWithClosing: filtered.length,
                    totalTips,
                    avgDailyTips: Math.round(avgDaily),
                    byDay,
                };
            },
        }),
        createDailyClosing: tool({
            description: 'Crea un cierre diario con desglose por método de pago. Requiere confirmación del usuario. Sincroniza transacciones automáticamente.',
            parameters: z.object({
                date: z.string().describe('Fecha del cierre (YYYY-MM-DD)'),
                ap: z.number().describe('Monto pagado vía AP (app)'),
                qr: z.number().describe('Monto pagado vía QR'),
                datafono: z.number().describe('Monto pagado vía datáfono'),
                rappiVentas: z.number().describe('Ventas Rappi'),
                efectivo: z.number().describe('Ventas en efectivo'),
                propinas: z.number().describe('Total de propinas'),
                gastos: z.number().describe('Gastos del día'),
                cajaMenor: z.number().describe('Caja menor'),
                entregaEfectivo: z.number().describe('Entrega de efectivo'),
                responsable: z.string().describe('Nombre del responsable del cierre'),
            }),
        }),
    };
}
//# sourceMappingURL=daily-closing-tools.js.map