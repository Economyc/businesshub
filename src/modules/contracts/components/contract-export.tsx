import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import type { ContractClause } from '../types'

interface ContractExportProps {
  clauses: ContractClause[]
  title: string
  employeeName: string
}

/* ─── PDF generation (returns blob for reuse) ─── */
export async function generatePDFBlob(clauses: ContractClause[], title: string, employeeName: string): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')

  const pdf = new jsPDF({ unit: 'mm', format: 'letter' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const marginX = 25
  const marginTop = 30
  const marginBottom = 25
  const contentW = pageW - marginX * 2
  const maxY = pageH - marginBottom
  let y = marginTop
  let pageNum = 1

  const sorted = [...clauses].sort((a, b) => a.order - b.order)

  function addPageNumber() {
    pdf.setFontSize(8)
    pdf.setTextColor(160, 160, 160)
    pdf.text(`Página ${pageNum}`, pageW / 2, pageH - 12, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
  }

  function checkNewPage(needed: number) {
    if (y + needed > maxY) {
      addPageNumber()
      pdf.addPage()
      pageNum++
      y = marginTop
    }
  }

  // Title
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  const titleLines = pdf.splitTextToSize(title.toUpperCase(), contentW)
  titleLines.forEach((line: string) => {
    checkNewPage(8)
    pdf.text(line, pageW / 2, y, { align: 'center' })
    y += 7
  })
  y += 6

  // Clauses
  const isSignature = (c: ContractClause) =>
    c.id === 'clause_signature' || c.title.toUpperCase().includes('FIRMA')

  sorted.forEach((clause) => {
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    const headLines = pdf.splitTextToSize(clause.title, contentW)
    checkNewPage(headLines.length * 5 + 10)
    headLines.forEach((line: string) => {
      pdf.text(line, marginX, y)
      y += 5
    })
    y += 2

    if (isSignature(clause)) {
      // Parse signature block
      const lines = clause.content.split('\n')
      const introLines: string[] = []
      let sigStarted = false
      const leftCol: string[] = []
      const rightCol: string[] = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (!sigStarted && trimmed.startsWith('____')) {
          sigStarted = true
          leftCol.push('________________________')
          rightCol.push('________________________')
          continue
        }
        if (!sigStarted) { if (trimmed) introLines.push(trimmed); continue }
        const parts = line.split(/\s{4,}/)
        const left = parts[0]?.trim() ?? ''
        const right = parts[1]?.trim() ?? ''
        if (parts.length === 1 && left) {
          if (left.startsWith('EL TRABAJADOR') || left.startsWith('C.C') || left.startsWith('{{employee'))
            rightCol.push(left)
          else leftCol.push(left)
        } else {
          if (left) leftCol.push(left)
          if (right) rightCol.push(right)
        }
      }

      // Render intro
      if (introLines.length) {
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        const intro = pdf.splitTextToSize(introLines.join(' '), contentW) as string[]
        intro.forEach((l: string) => { checkNewPage(5); pdf.text(l, marginX, y); y += 4.5 })
        y += 10
      }

      // Render two columns
      checkNewPage(40)
      const colW = contentW / 2 - 5
      const leftX = marginX
      const rightX = marginX + contentW / 2 + 5
      const startY = y
      const maxRows = Math.max(leftCol.length, rightCol.length)

      for (let r = 0; r < maxRows; r++) {
        const isLabel = (leftCol[r] === 'EL EMPLEADOR' || rightCol[r] === 'EL TRABAJADOR')
        pdf.setFontSize(isLabel ? 10 : 9)
        pdf.setFont('helvetica', isLabel ? 'bold' : 'normal')
        if (leftCol[r]) pdf.text(pdf.splitTextToSize(leftCol[r], colW)[0], leftX, y)
        if (rightCol[r]) pdf.text(pdf.splitTextToSize(rightCol[r], colW)[0], rightX, y)
        y += leftCol[r]?.startsWith('____') ? 6 : 4.5
      }
      y = Math.max(y, startY) + 6
    } else {
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      const bodyLines = pdf.splitTextToSize(clause.content, contentW) as string[]
      bodyLines.forEach((line: string) => {
        checkNewPage(5)
        pdf.text(line, marginX, y)
        y += 4.5
      })
      y += 6
    }
  })

  addPageNumber()

  return pdf.output('blob')
}

/* ─── PDF Export (download) ─── */
async function exportPDF(clauses: ContractClause[], title: string, employeeName: string) {
  const blob = await generatePDFBlob(clauses, title, employeeName)
  const date = new Date().toISOString().slice(0, 10)
  const safeName = employeeName.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '').trim().replace(/\s+/g, '_')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Contrato_${safeName}_${date}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

/* ─── Word Export ─── */
async function exportWord(clauses: ContractClause[], title: string, employeeName: string) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = await import('docx')
  const { saveAs } = await import('file-saver')

  const sorted = [...clauses].sort((a, b) => a.order - b.order)

  const children: InstanceType<typeof Paragraph>[] = []

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 28,
          font: 'Calibri',
        }),
      ],
    })
  )

  // Clauses
  sorted.forEach((clause) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 120 },
        children: [
          new TextRun({
            text: clause.title,
            bold: true,
            size: 22,
            font: 'Calibri',
          }),
        ],
      })
    )

    // Split content by newlines to preserve paragraph structure
    const paragraphs = clause.content.split('\n')
    paragraphs.forEach((para) => {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: para,
              size: 20,
              font: 'Calibri',
            }),
          ],
        })
      )
    })
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const date = new Date().toISOString().slice(0, 10)
  const safeName = employeeName.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '').trim().replace(/\s+/g, '_')
  saveAs(blob, `Contrato_${safeName}_${date}.docx`)
}

/* ─── Component ─── */
export function ContractExport({ clauses, title, employeeName }: ContractExportProps) {
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)

  async function handlePDF() {
    setExportingPdf(true)
    try {
      await exportPDF(clauses, title, employeeName)
    } catch (err) {
      console.error('Error exporting PDF:', err)
    } finally {
      setExportingPdf(false)
    }
  }

  async function handleWord() {
    setExportingWord(true)
    try {
      await exportWord(clauses, title, employeeName)
    } catch (err) {
      console.error('Error exporting Word:', err)
    } finally {
      setExportingWord(false)
    }
  }

  return (
    <>
      <button
        onClick={handlePDF}
        disabled={exportingPdf}
        className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone disabled:opacity-60"
      >
        <Download size={14} strokeWidth={1.5} />
        {exportingPdf ? 'Exportando...' : 'PDF'}
      </button>
      <button
        onClick={handleWord}
        disabled={exportingWord}
        className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone disabled:opacity-60"
      >
        <FileText size={14} strokeWidth={1.5} />
        {exportingWord ? 'Exportando...' : 'Word'}
      </button>
    </>
  )
}
