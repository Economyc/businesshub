export type SlashCommand = {
  /** Identificador del comando (sin la barra). Ej: "reporte". */
  name: string
  /** Etiqueta visible en el menu. */
  label: string
  /** Descripcion breve mostrada bajo la etiqueta. */
  description: string
  /** Nombre opcional de icono Lucide (no se usa por defecto, reservado para futuro). */
  icon?: string
  /** Expande el comando (con sus argumentos) a un prompt completo. */
  template: (args: string) => string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'reporte',
    label: 'Reporte mensual',
    description: 'Genera el reporte ejecutivo del mes',
    template: (args) =>
      `Genera el reporte ejecutivo del mes${args ? ' de ' + args : ' actual'}`,
  },
  {
    name: 'cierre',
    label: 'Cierre de mes',
    description: 'Ejecuta el cierre contable del mes',
    template: (args) =>
      `Genera el cierre del mes${args ? ' de ' + args : ' pasado'}`,
  },
  {
    name: 'cobrar',
    label: 'Cobrar a proveedor',
    description: 'Inicia gestión de cobranza',
    template: (args) =>
      `Muéstrame el estado de cobranza${args ? ' de ' + args : ''}`,
  },
  {
    name: 'buscar',
    label: 'Búsqueda multi-módulo',
    description: 'Busca en todos los módulos',
    template: (args) => `Busca en todos los módulos: ${args || ''}`,
  },
  {
    name: 'resumen',
    label: 'Resumen rápido',
    description: 'Resumen ejecutivo de hoy',
    template: () =>
      `Dame un resumen ejecutivo de hoy: ventas, gastos clave, alertas`,
  },
]

export type ParsedSlash = {
  command: SlashCommand | null
  args: string
}

/** Normaliza para hacer match case-insensitive y sin tildes. */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Parsea un input que empieza con "/".
 * - "/reporte abril" → { command: SLASH_COMMANDS[reporte], args: "abril" }
 * - "/reporte"       → { command: SLASH_COMMANDS[reporte], args: "" }
 * - "/xyz"           → { command: null, args: "" }  (token reconocible pero sin match)
 * - "hola"           → null (no empieza con "/")
 */
export function parseSlashCommand(input: string): ParsedSlash | null {
  if (!input.startsWith('/')) return null
  const rest = input.slice(1)
  const spaceIdx = rest.indexOf(' ')
  const name = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
  const args = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim()
  const command =
    SLASH_COMMANDS.find((c) => normalize(c.name) === normalize(name)) ?? null
  return { command, args }
}

/** Devuelve los comandos cuyo `name` o `label` matchean la query. */
export function filterSlashCommands(query: string): SlashCommand[] {
  const q = normalize(query.trim())
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    (c) => normalize(c.name).includes(q) || normalize(c.label).includes(q),
  )
}
