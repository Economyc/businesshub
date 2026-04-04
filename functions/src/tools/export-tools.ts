import { tool } from 'ai'
import { z } from 'zod'

/**
 * Export tool — no execute function.
 * Returns structured data to the frontend which generates and downloads the file.
 */
export function createExportTools() {
  return {
    exportReport: tool({
      description:
        'Exporta un reporte a PDF o Excel. Usa esta herramienta DESPUÉS de generar datos con otra herramienta. Envía los datos ya procesados para que el frontend genere el archivo.',
      parameters: z.object({
        format: z.enum(['pdf', 'excel']).describe('Formato de exportación: pdf o excel'),
        title: z.string().describe('Título del reporte'),
        sections: z.array(
          z.object({
            heading: z.string().describe('Título de la sección'),
            type: z.enum(['table', 'kpi', 'text']).describe('Tipo: table (datos tabulares), kpi (indicadores clave), text (texto libre)'),
            data: z.unknown().describe('Datos de la sección. Para table: {headers: string[], rows: string[][]}. Para kpi: {label: string, value: string}[]. Para text: string.'),
          })
        ).describe('Secciones del reporte'),
      }),
    }),
  }
}
