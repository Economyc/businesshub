import { tool } from 'ai';
import { z } from 'zod';
import { fetchCollection } from '../firestore.js';
function tsToDate(val) {
    if (val && typeof val === 'object' && '_seconds' in val) {
        return new Date(val._seconds * 1000);
    }
    return null;
}
function tsToIso(val) {
    const d = tsToDate(val);
    return d ? d.toISOString().split('T')[0] : null;
}
function inRange(val, start, end) {
    const d = tsToDate(val);
    if (!d)
        return false;
    const iso = d.toISOString().split('T')[0];
    return iso >= start && iso <= end;
}
export function createMarketingTools(companyId) {
    return {
        getInfluencerVisits: tool({
            description: 'Lista las visitas de influencers registradas. Incluye nombre, redes sociales, fecha, orden vinculada, checklist de contenido (story/post/reel) y estado (pending/completed).',
            parameters: z.object({
                status: z.enum(['pending', 'completed']).optional().describe('Filtrar por estado'),
                startDate: z.string().optional().describe('Fecha inicio (YYYY-MM-DD)'),
                endDate: z.string().optional().describe('Fecha fin (YYYY-MM-DD)'),
            }),
            execute: async ({ status, startDate, endDate }) => {
                const all = await fetchCollection(companyId, 'influencer-visits');
                let filtered = all;
                if (status)
                    filtered = filtered.filter((v) => v.status === status);
                if (startDate && endDate) {
                    filtered = filtered.filter((v) => inRange(v.visitDate, startDate, endDate));
                }
                filtered.sort((a, b) => {
                    const aT = tsToDate(a.visitDate)?.getTime() ?? 0;
                    const bT = tsToDate(b.visitDate)?.getTime() ?? 0;
                    return bT - aT;
                });
                return {
                    count: filtered.length,
                    pending: all.filter((v) => v.status === 'pending').length,
                    completed: all.filter((v) => v.status === 'completed').length,
                    visits: filtered.map((v) => ({
                        id: v.id,
                        name: v.name,
                        socialNetworks: v.socialNetworks,
                        visitDate: tsToIso(v.visitDate),
                        content: v.content,
                        status: v.status,
                        order: v.order,
                        notes: v.notes,
                    })),
                };
            },
        }),
        getInfluencerContentReport: tool({
            description: 'Reporte de contenido generado por influencers en un rango: cuenta de stories, posts y reels; top influencers por contenido.',
            parameters: z.object({
                startDate: z.string().describe('Fecha inicio (YYYY-MM-DD)'),
                endDate: z.string().describe('Fecha fin (YYYY-MM-DD)'),
            }),
            execute: async ({ startDate, endDate }) => {
                const all = await fetchCollection(companyId, 'influencer-visits');
                const filtered = all.filter((v) => inRange(v.visitDate, startDate, endDate));
                let stories = 0;
                let posts = 0;
                let reels = 0;
                const byInfluencer = new Map();
                for (const v of filtered) {
                    const content = v.content ?? {};
                    const contentCount = (content.story ? 1 : 0) + (content.post ? 1 : 0) + (content.reel ? 1 : 0);
                    if (content.story)
                        stories += 1;
                    if (content.post)
                        posts += 1;
                    if (content.reel)
                        reels += 1;
                    const name = String(v.name ?? 'Sin nombre');
                    const entry = byInfluencer.get(name) ?? { visits: 0, content: 0 };
                    entry.visits += 1;
                    entry.content += contentCount;
                    byInfluencer.set(name, entry);
                }
                const topInfluencers = Array.from(byInfluencer.entries())
                    .map(([name, data]) => ({ name, ...data }))
                    .sort((a, b) => b.content - a.content)
                    .slice(0, 10);
                return {
                    dateRange: { startDate, endDate },
                    visitsCount: filtered.length,
                    stories,
                    posts,
                    reels,
                    totalContent: stories + posts + reels,
                    topInfluencers,
                };
            },
        }),
        createInfluencerVisit: tool({
            description: 'Registra una nueva visita de influencer. Requiere confirmación del usuario.',
            parameters: z.object({
                name: z.string().describe('Nombre del influencer'),
                socialNetworks: z
                    .array(z.object({
                    platform: z.enum(['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'other']),
                    handle: z.string(),
                }))
                    .describe('Redes sociales del influencer'),
                visitDate: z.string().describe('Fecha de la visita (YYYY-MM-DD)'),
                content: z
                    .object({
                    story: z.boolean(),
                    post: z.boolean(),
                    reel: z.boolean(),
                })
                    .describe('Checklist de contenido generado'),
                notes: z.string().optional().describe('Notas adicionales'),
                status: z.enum(['pending', 'completed']).optional().default('pending'),
            }),
        }),
    };
}
//# sourceMappingURL=marketing-tools.js.map