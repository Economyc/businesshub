import { useMemo } from 'react'
import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Simple markdown-to-HTML for assistant messages.
 * Handles: **bold**, tables, lists, line breaks.
 */
function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Tables
  const lines = html.split('\n')
  const tableLines: string[] = []
  const outputLines: string[] = []
  let inTable = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        inTable = true
        tableLines.length = 0
      }
      // Skip separator rows (|---|---|)
      if (!/^\|[\s\-:|]+\|$/.test(trimmed)) {
        tableLines.push(trimmed)
      }
    } else {
      if (inTable) {
        outputLines.push(buildTable(tableLines))
        tableLines.length = 0
        inTable = false
      }
      outputLines.push(line)
    }
  }
  if (inTable) {
    outputLines.push(buildTable(tableLines))
  }

  html = outputLines.join('\n')

  // Bold (must be before bullet list processing since * is used for both)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Headers (### before ##)
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="text-sm font-semibold text-dark-graphite mt-3 mb-1">$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="text-sm font-bold text-dark-graphite mt-3 mb-1.5">$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="text-base font-bold text-dark-graphite mt-4 mb-2">$1</h2>')

  // Bullet lists (- or * or •)
  html = html.replace(/^[\s]*[-*•]\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-4 space-y-0.5 my-1">$&</ul>')

  // Numbered lists
  html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li>$1</li>')

  // Line breaks
  html = html.replace(/\n/g, '<br/>')

  // Clean up br inside headers, lists, and tables
  html = html.replace(/<br\/>\s*<li>/g, '<li>')
  html = html.replace(/<\/li>\s*<br\/>/g, '</li>')
  html = html.replace(/<br\/>\s*<table/g, '<table')
  html = html.replace(/<\/table>\s*<br\/>/g, '</table>')
  html = html.replace(/<br\/>\s*<h([234])/g, '<h$1')
  html = html.replace(/<\/h([234])>\s*<br\/>/g, '</h$1>')
  html = html.replace(/<br\/>\s*<ul/g, '<ul')
  html = html.replace(/<\/ul>\s*<br\/>/g, '</ul>')

  return html
}

function isNumericCell(text: string): boolean {
  return /^[\s]*[\-]?[\$]?[\d.,]+[%]?[\s]*$/.test(text) || /&lt;strong&gt;[\s]*[\-]?[\$]?[\d.,]+[%]?[\s]*&lt;\/strong&gt;/.test(text)
}

function buildTable(lines: string[]): string {
  if (lines.length === 0) return ''
  const rows = lines.map((line) =>
    line
      .split('|')
      .filter((_, i, arr) => i > 0 && i < arr.length - 1)
      .map((cell) => cell.trim())
  )
  const header = rows[0]
  const body = rows.slice(1)

  let html = '<div class="overflow-x-auto my-2"><table class="text-xs border-collapse w-full">'
  html += '<thead><tr>'
  for (const h of header) {
    const align = isNumericCell(h) ? 'text-right' : 'text-left'
    html += `<th class="border border-border/60 px-2.5 py-1.5 ${align} bg-card-bg font-semibold text-dark-graphite">${h}</th>`
  }
  html += '</tr></thead><tbody>'
  for (let r = 0; r < body.length; r++) {
    const row = body[r]
    const isLast = r === body.length - 1
    const rowClass = isLast ? 'bg-card-bg/50 font-medium' : 'hover:bg-card-bg/30 transition-colors'
    html += `<tr class="${rowClass}">`
    for (let i = 0; i < header.length; i++) {
      const cell = row[i] ?? ''
      const align = isNumericCell(cell) ? 'text-right tabular-nums' : 'text-left'
      html += `<td class="border border-border/60 px-2.5 py-1.5 ${align}">${cell}</td>`
    }
    html += '</tr>'
  }
  html += '</tbody></table></div>'
  return html
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user'

  const renderedContent = useMemo(() => {
    if (isUser) return null
    return renderMarkdown(content)
  }, [content, isUser])

  return (
    <div className={cn('flex gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-3', isUser ? 'flex-row-reverse' : '')}>
      {/* Avatar - hidden on mobile for more bubble space */}
      <div className={cn(
        'shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 hidden sm:flex',
        isUser ? 'bg-primary/10' : 'bg-graphite/10'
      )}>
        {isUser ? (
          <User size={14} strokeWidth={1.5} className="text-primary" />
        ) : (
          <Bot size={14} strokeWidth={1.5} className="text-graphite" />
        )}
      </div>
      <div className={cn(
        'max-w-[88%] sm:max-w-[85%] px-3.5 sm:px-4 py-2.5 text-sm leading-relaxed shadow-sm',
        isUser
          ? 'bg-dark-graphite text-white rounded-[18px] rounded-tr-[4px]'
          : 'bg-card-bg text-dark-graphite border border-border/60 rounded-[18px] rounded-tl-[4px]'
      )}>
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{content}</div>
        ) : (
          <div
            className="break-words [&_strong]:font-semibold [&_ul]:my-1 [&_li]:text-sm"
            dangerouslySetInnerHTML={{ __html: renderedContent! }}
          />
        )}
      </div>
    </div>
  )
}
