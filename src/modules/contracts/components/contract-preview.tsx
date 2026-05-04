import { useRef, useEffect, useState, type ReactNode } from 'react'
import type { ContractClause } from '../types'

/* ─── Constants ─── */
const PAGE_WIDTH = 680
const PAGE_HEIGHT = 880
const PAGE_PADDING_X = 64
const PAGE_PADDING_Y = 56

interface ContractPreviewProps {
  clauses: ContractClause[]
  title?: string
}

/* ─── Detect signature clause ─── */
function isSignatureClause(clause: ContractClause): boolean {
  return clause.id === 'clause_signature'
    || clause.title.toUpperCase().includes('FIRMA')
    || clause.content.includes('EL EMPLEADOR') && clause.content.includes('EL TRABAJADOR')
}

/* ─── Parse signature block into structured data ─── */
function parseSignatureBlock(content: string) {
  // Split into intro text and the signature lines
  const lines = content.split('\n')
  const introLines: string[] = []
  let signatureStarted = false
  const leftLines: string[] = []
  const rightLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!signatureStarted && trimmed.startsWith('____')) {
      signatureStarted = true
      // Both signature lines on same row
      leftLines.push('________________________')
      rightLines.push('________________________')
      continue
    }
    if (!signatureStarted) {
      if (trimmed) introLines.push(trimmed)
      continue
    }
    // Parse two-column lines (separated by lots of spaces)
    const parts = line.split(/\s{4,}/)
    const left = parts[0]?.trim() ?? ''
    const right = parts[1]?.trim() ?? ''
    // If only one part, figure out which column
    if (parts.length === 1 && left) {
      if (left.startsWith('EL TRABAJADOR') || left.startsWith('C.C') || left.startsWith('{{employeeName') || left.startsWith('{{employeeIdentification')) {
        rightLines.push(left)
      } else {
        leftLines.push(left)
      }
    } else {
      if (left) leftLines.push(left)
      if (right) rightLines.push(right)
    }
  }

  return { intro: introLines.join(' '), leftLines, rightLines }
}

/* ─── Render signature block ─── */
function renderSignatureBlock(clause: ContractClause) {
  const { intro, leftLines, rightLines } = parseSignatureBlock(clause.content)

  return (
    <div key={clause.id}>
      <h3 className="text-[13px] font-semibold text-dark-graphite mb-1.5">
        {clause.title}
      </h3>
      {intro && (
        <p className="text-[13px] text-graphite leading-relaxed mb-8">
          {highlightUnresolved(intro)}
        </p>
      )}
      <div className="grid grid-cols-2 gap-12 mt-4">
        <div className="flex flex-col items-start">
          {leftLines.map((line, i) => (
            <span
              key={i}
              className={`text-[13px] ${
                line.startsWith('____') ? 'text-dark-graphite mb-1' :
                line === 'EL EMPLEADOR' ? 'font-semibold text-dark-graphite' :
                'text-graphite'
              }`}
            >
              {highlightUnresolved(line)}
            </span>
          ))}
        </div>
        <div className="flex flex-col items-start">
          {rightLines.map((line, i) => (
            <span
              key={i}
              className={`text-[13px] ${
                line.startsWith('____') ? 'text-dark-graphite mb-1' :
                line === 'EL TRABAJADOR' ? 'font-semibold text-dark-graphite' :
                'text-graphite'
              }`}
            >
              {highlightUnresolved(line)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Render a regular clause ─── */
function renderClause(clause: ContractClause) {
  if (isSignatureClause(clause)) return renderSignatureBlock(clause)
  return (
    <div key={clause.id}>
      <h3 className="text-[13px] font-semibold text-dark-graphite mb-1.5">
        {clause.title}
      </h3>
      <p className="text-[13px] text-graphite leading-relaxed whitespace-pre-wrap">
        {highlightUnresolved(clause.content)}
      </p>
    </div>
  )
}

/* ─── Main component ─── */
export function ContractPreview({ clauses, title }: ContractPreviewProps) {
  const sorted = [...clauses].sort((a, b) => a.order - b.order)
  const measureRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<ReactNode[][]>([])

  useEffect(() => {
    if (!measureRef.current) return

    const children = Array.from(measureRef.current.children) as HTMLElement[]
    const result: ReactNode[][] = [[]]
    let currentHeight = 0
    let pageIdx = 0

    const titleEl = children[0]
    if (title && titleEl) {
      currentHeight = titleEl.offsetHeight + 24
    }

    const clauseElements = title ? children.slice(1) : children

    sorted.forEach((clause, i) => {
      const el = clauseElements[i]
      if (!el) return
      const h = el.offsetHeight + 20

      if (currentHeight + h > PAGE_HEIGHT && currentHeight > 0) {
        pageIdx++
        result.push([])
        currentHeight = 0
      }

      result[pageIdx].push(renderClause(clause))
      currentHeight += h
    })

    setPages(result)
  }, [clauses, title])

  return (
    <div>
      {/* Hidden measure container */}
      <div
        ref={measureRef}
        className="fixed left-[-9999px] top-0"
        style={{ width: PAGE_WIDTH - PAGE_PADDING_X * 2, fontFamily: 'inherit' }}
        aria-hidden
      >
        {title && (
          <h1 className="text-center text-[15px] font-bold mb-6 uppercase tracking-wide">
            {title}
          </h1>
        )}
        {sorted.map((clause) => (
          <div key={clause.id} className="mb-5">
            <h3 className="text-[13px] font-semibold mb-1.5">{clause.title}</h3>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{clause.content}</p>
          </div>
        ))}
      </div>

      {/* Rendered pages */}
      <div className="flex flex-col items-center gap-8 print:gap-0">
        {pages.map((pageContent, pageIdx) => (
          <div
            key={pageIdx}
            className="contract-page bg-white rounded-lg border border-border print:border-none print:rounded-none"
            style={{
              width: PAGE_WIDTH,
              minHeight: PAGE_HEIGHT + PAGE_PADDING_Y * 2,
              padding: `${PAGE_PADDING_Y}px ${PAGE_PADDING_X}px`,
              pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto',
            }}
          >
            {pageIdx === 0 && title && (
              <h1 className="text-center text-[15px] font-bold text-dark-graphite mb-6 uppercase tracking-wide">
                {title}
              </h1>
            )}

            <div className="space-y-5">
              {pageContent}
            </div>

            <div className="text-center text-[10px] text-gray-400 print:block" style={{ marginTop: 'auto', paddingTop: 24 }}>
              Página {pageIdx + 1} de {pages.length}
            </div>
          </div>
        ))}

        {/* Fallback while measuring */}
        {pages.length === 0 && (
          <div
            className="bg-white rounded-lg border border-gray-200 shadow-sm"
            style={{
              width: PAGE_WIDTH,
              minHeight: PAGE_HEIGHT + PAGE_PADDING_Y * 2,
              padding: `${PAGE_PADDING_Y}px ${PAGE_PADDING_X}px`,
            }}
          >
            {title && (
              <h1 className="text-center text-[15px] font-bold text-dark-graphite mb-6 uppercase tracking-wide">
                {title}
              </h1>
            )}
            <div className="space-y-5">
              {sorted.map((clause) => renderClause(clause))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Highlight unresolved placeholders ─── */
function highlightUnresolved(text: string) {
  const parts = text.split(/(\{\{[^}]+\}\})/g)
  return parts.map((part, i) => {
    if (/^\{\{[^}]+\}\}$/.test(part)) {
      return (
        <span key={i} className="bg-amber-100 text-amber-800 px-1 rounded text-[11px] font-medium print:bg-yellow-100">
          {part}
        </span>
      )
    }
    return part
  })
}
