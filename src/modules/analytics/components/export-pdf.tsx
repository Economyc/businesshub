import { useState, type RefObject } from 'react'
import { Download } from 'lucide-react'

interface ExportPDFProps {
  targetRef: RefObject<HTMLDivElement | null>
}

export function ExportPDF({ targetRef }: ExportPDFProps) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (!targetRef.current || exporting) return
    setExporting(true)
    try {
      // Carga dinámica: html2canvas + jspdf pesan ~250KB combinado.
      // Los dashboards no los necesitan hasta que el usuario exporte.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#faf9f7',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save('analisis.pdf')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite hover:bg-bone transition-all duration-200 disabled:opacity-50"
    >
      <Download size={15} strokeWidth={1.5} />
      {exporting ? 'Exportando...' : 'PDF'}
    </button>
  )
}
