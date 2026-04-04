import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

interface ReportSection {
  heading: string
  type: 'table' | 'kpi' | 'text'
  data: unknown
}

interface TableData {
  headers: string[]
  rows: string[][]
}

interface KpiData {
  label: string
  value: string
}

// ─── PDF Export ───

export function exportToPDF(title: string, sections: ReportSection[]) {
  const doc = new jsPDF()
  let y = 20

  // Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, y)
  y += 10

  // Date
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(128, 128, 128)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CL')}`, 14, y)
  doc.setTextColor(0, 0, 0)
  y += 12

  for (const section of sections) {
    // Check page break
    if (y > 260) {
      doc.addPage()
      y = 20
    }

    // Section heading
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(section.heading, 14, y)
    y += 8

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')

    if (section.type === 'kpi') {
      const kpis = section.data as KpiData[]
      for (const kpi of kpis) {
        doc.text(`${kpi.label}: ${kpi.value}`, 18, y)
        y += 6
      }
      y += 4
    } else if (section.type === 'table') {
      const table = section.data as TableData
      if (table.headers && table.rows) {
        const colWidths = table.headers.map(() => Math.floor(180 / table.headers.length))

        // Header row
        doc.setFont('helvetica', 'bold')
        doc.setFillColor(240, 240, 240)
        doc.rect(14, y - 4, 182, 7, 'F')
        let x = 16
        for (let i = 0; i < table.headers.length; i++) {
          doc.text(table.headers[i], x, y)
          x += colWidths[i]
        }
        y += 7

        // Data rows
        doc.setFont('helvetica', 'normal')
        for (const row of table.rows) {
          if (y > 275) {
            doc.addPage()
            y = 20
          }
          x = 16
          for (let i = 0; i < row.length; i++) {
            doc.text(String(row[i] ?? ''), x, y)
            x += colWidths[i]
          }
          y += 5
        }
        y += 4
      }
    } else if (section.type === 'text') {
      const text = String(section.data)
      const lines = doc.splitTextToSize(text, 180) as string[]
      for (const line of lines) {
        if (y > 275) {
          doc.addPage()
          y = 20
        }
        doc.text(line, 18, y)
        y += 5
      }
      y += 4
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    doc.text(`BusinessHub — Página ${i} de ${pageCount}`, 14, 290)
  }

  doc.save(`${title.replace(/\s+/g, '_')}.pdf`)
}

// ─── Excel Export ───

export function exportToExcel(title: string, sections: ReportSection[]) {
  const wb = XLSX.utils.book_new()

  for (const section of sections) {
    const sheetName = section.heading.slice(0, 31) // Excel max sheet name length

    if (section.type === 'table') {
      const table = section.data as TableData
      if (table.headers && table.rows) {
        const ws = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows])
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
      }
    } else if (section.type === 'kpi') {
      const kpis = section.data as KpiData[]
      const rows = kpis.map((k) => [k.label, k.value])
      const ws = XLSX.utils.aoa_to_sheet([['Indicador', 'Valor'], ...rows])
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    } else if (section.type === 'text') {
      const ws = XLSX.utils.aoa_to_sheet([[String(section.data)]])
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }
  }

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${title.replace(/\s+/g, '_')}.xlsx`)
}
