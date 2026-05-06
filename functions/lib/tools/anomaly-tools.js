import { tool } from 'ai';
import { z } from 'zod';
import { fetchCollection } from '../firestore.js';
function tsToIso(val) {
    if (val && typeof val === 'object' && '_seconds' in val) {
        return new Date(val._seconds * 1000).toISOString();
    }
    return null;
}
function tsToMillis(val) {
    if (val && typeof val === 'object' && '_seconds' in val) {
        return val._seconds * 1000;
    }
    return 0;
}
export function createAnomalyTools(companyId) {
    return {
        getDetectedAnomalies: tool({
            description: 'Lista las anomalías detectadas automáticamente por el sistema (gastos inusuales, caídas de ventas, contratos por vencer). Úsala cuando el usuario pregunte "¿hay algo raro?", "¿qué alertas hay?", "¿algo fuera de lo normal?".',
            parameters: z.object({
                severity: z.enum(['info', 'warning']).optional().describe('Filtrar por severidad'),
                since: z.string().optional().describe('Fecha mínima de creación (YYYY-MM-DD). Si se omite, devuelve todas.'),
                includeAcknowledged: z
                    .boolean()
                    .optional()
                    .default(false)
                    .describe('Si es true, incluye anomalías ya marcadas como atendidas. Default: false.'),
                limit: z.number().optional().default(20).describe('Máximo de resultados (default: 20)'),
            }),
            execute: async ({ severity, since, includeAcknowledged, limit }) => {
                const all = await fetchCollection(companyId, 'notifications');
                let anomalies = all.filter((n) => n.type === 'anomaly');
                if (!includeAcknowledged) {
                    anomalies = anomalies.filter((n) => !n.acknowledged);
                }
                if (severity) {
                    anomalies = anomalies.filter((n) => n.severity === severity);
                }
                if (since) {
                    const sinceMs = new Date(since).getTime();
                    if (Number.isFinite(sinceMs)) {
                        anomalies = anomalies.filter((n) => tsToMillis(n.createdAt) >= sinceMs);
                    }
                }
                anomalies.sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
                const limited = anomalies.slice(0, limit);
                return {
                    totalCount: all.filter((n) => n.type === 'anomaly').length,
                    unacknowledgedCount: all.filter((n) => n.type === 'anomaly' && !n.acknowledged).length,
                    returnedCount: limited.length,
                    anomalies: limited.map((n) => ({
                        id: n.id,
                        severity: n.severity ?? 'info',
                        title: n.title,
                        description: n.description ?? n.summary ?? '',
                        evidence: n.evidence ?? n.data ?? {},
                        acknowledged: Boolean(n.acknowledged),
                        createdAt: tsToIso(n.createdAt),
                    })),
                };
            },
        }),
        acknowledgeAnomaly: tool({
            description: 'Marca una anomalía como atendida (acknowledged=true). Úsala cuando el usuario diga "ya la vi", "atendida", "ignórala". Requiere confirmación del usuario.',
            parameters: z.object({
                notificationId: z.string().describe('ID de la notificación de anomalía a marcar como atendida'),
            }),
        }),
    };
}
//# sourceMappingURL=anomaly-tools.js.map