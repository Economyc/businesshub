// Wave 6.2 — Cliente HTTP del plugin Obsidian Local REST API.
//
// Endpoint típico: https://127.0.0.1:27124 (TLS autofirmado) o
// http://127.0.0.1:27123. Auth via header `Authorization: Bearer <token>`.
// Para escribir una nota: PUT /vault/<path>.md con body markdown crudo.
// Docs: https://github.com/coddingtonbear/obsidian-local-rest-api

export interface ObsidianClientConfig {
  endpoint: string
  token: string
}

export interface SaveNoteArgs {
  title: string
  content: string
  folder?: string
  tags?: string[]
  frontmatter?: Record<string, unknown>
}

export interface SaveNoteResult {
  ok: boolean
  path: string
  status?: number
  error?: string
}

const DEFAULT_FOLDER = 'Inbox/auto'

// Caracteres reservados/inválidos en nombres de archivo en Windows + tipicos
// problemas de Obsidian. Reemplazamos por guion para preservar legibilidad.
const INVALID_TITLE_CHARS = /[\\/:*?"<>|#^[\]]/g
const INVALID_FOLDER_SEGMENT_CHARS = /[\\:*?"<>|#^[\]]/g

export function sanitizeTitle(raw: string): string {
  return raw
    .replace(INVALID_TITLE_CHARS, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'nota'
}

export function sanitizeFolder(raw: string | undefined): string {
  const folder = (raw ?? DEFAULT_FOLDER).trim()
  if (!folder) return DEFAULT_FOLDER
  return folder
    .split(/[\\/]+/)
    .map((seg) => seg.replace(INVALID_FOLDER_SEGMENT_CHARS, '-').trim())
    .filter(Boolean)
    .join('/')
}

function escapeYamlString(value: string): string {
  // Estrategia simple: si contiene caracteres especiales, envolvemos en
  // comillas dobles y escapamos backslash + dobles comillas.
  if (/[":#&*!|>%@`{}[\],?\-\n]/.test(value) || value.trim() !== value || value === '') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `"${escaped}"`
  }
  return value
}

function yamlValue(value: unknown, indent = 0): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return escapeYamlString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const pad = ' '.repeat(indent)
    return '\n' + value.map((v) => `${pad}- ${yamlValue(v, indent + 2)}`).join('\n')
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    const pad = ' '.repeat(indent)
    return (
      '\n' +
      entries
        .map(([k, v]) => `${pad}${k}: ${yamlValue(v, indent + 2)}`)
        .join('\n')
    )
  }
  return escapeYamlString(String(value))
}

export function buildMarkdown(args: SaveNoteArgs): string {
  const today = new Date().toISOString().slice(0, 10)
  const fm: Record<string, unknown> = {
    title: args.title,
    date: today,
    ...(args.frontmatter ?? {}),
  }
  if (args.tags && args.tags.length > 0) {
    fm.tags = args.tags
  }

  const fmLines: string[] = ['---']
  for (const [k, v] of Object.entries(fm)) {
    fmLines.push(`${k}: ${yamlValue(v, 2)}`)
  }
  fmLines.push('---', '')

  // Tags inline al inicio del cuerpo (además del frontmatter) para que el
  // grafo de Obsidian las indexe igual aunque el usuario no use propiedades.
  const inlineTags =
    args.tags && args.tags.length > 0
      ? args.tags.map((t) => `#${t.replace(/\s+/g, '-')}`).join(' ') + '\n\n'
      : ''

  return fmLines.join('\n') + inlineTags + args.content.trim() + '\n'
}

export function buildNotePath(args: SaveNoteArgs): string {
  const folder = sanitizeFolder(args.folder)
  const title = sanitizeTitle(args.title)
  return `${folder}/${title}.md`
}

export async function saveNoteToObsidian(
  config: ObsidianClientConfig,
  args: SaveNoteArgs,
): Promise<SaveNoteResult> {
  if (!config.endpoint || !config.token) {
    return { ok: false, path: '', error: 'Endpoint o token no configurados.' }
  }

  const path = buildNotePath(args)
  const url = `${config.endpoint.replace(/\/+$/, '')}/vault/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
  const body = buildMarkdown(args)

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'text/markdown; charset=utf-8',
      },
      body,
    })

    // El plugin responde 204 (No Content) para PUT exitoso.
    if (res.ok || res.status === 204) {
      return { ok: true, path, status: res.status }
    }

    let errorText = `HTTP ${res.status}`
    try {
      const text = await res.text()
      if (text) errorText += `: ${text.slice(0, 200)}`
    } catch {
      // ignore
    }
    return { ok: false, path, status: res.status, error: errorText }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { ok: false, path, error: message }
  }
}

export async function testObsidianConnection(
  config: ObsidianClientConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.endpoint || !config.token) {
    return { ok: false, error: 'Endpoint o token no configurados.' }
  }
  try {
    const url = `${config.endpoint.replace(/\/+$/, '')}/vault/`
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.token}` },
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: `HTTP ${res.status}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { ok: false, error: message }
  }
}
