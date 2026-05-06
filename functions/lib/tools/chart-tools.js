import { tool } from 'ai';
import { z } from 'zod';
/**
 * Chart tool — no execute function.
 * Returns structured data to the frontend which renders it using Recharts.
 * The agent decides chart type and data based on context.
 */
export function createChartTools() {
    return {
        generateChart: tool({
            description: 'Genera un gráfico visual dentro del chat. Usa esta herramienta DESPUÉS de obtener datos con otra herramienta. Envía los datos ya procesados para que el frontend los renderice como gráfico.',
            parameters: z.object({
                chartType: z.enum(['bar', 'pie', 'area', 'line']).describe('Tipo de gráfico: bar (comparaciones), pie (distribución %), area (tendencias con relleno), line (tendencias simples)'),
                title: z.string().describe('Título del gráfico'),
                data: z.array(z.object({
                    name: z.string().describe('Etiqueta del eje X o segmento'),
                    value: z.number().describe('Valor principal'),
                    value2: z.number().optional().describe('Segundo valor (para comparaciones)'),
                })).describe('Datos del gráfico. Cada elemento es un punto o segmento.'),
                valueLabel: z.string().optional().default('Valor').describe('Etiqueta para el valor principal'),
                value2Label: z.string().optional().describe('Etiqueta para el segundo valor (si existe)'),
                formatAsCurrency: z.boolean().optional().default(true).describe('Formatear valores como moneda CLP'),
            }),
        }),
    };
}
//# sourceMappingURL=chart-tools.js.map