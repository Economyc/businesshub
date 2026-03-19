import { useState } from 'react'
import { Download } from 'lucide-react'
import { useCompany } from '@/core/hooks/use-company'

interface ExportPDFProps {
  targetRef: React.RefObject<HTMLDivElement | null>
}

export function ExportPDF({ targetRef }: ExportPDFProps) {
  const [exporting, setExporting] = useState(false)
  const { selectedCompany } = useCompany()

  const handleExport = async () => {
    if (!targetRef.current) return
    setExporting(true)

    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default

      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f5f4f2',
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2],
      })

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)

      const date = new Date().toISOString().slice(0, 10)
      const companyName = selectedCompany?.name ?? 'Company'
      pdf.save(`BusinessHub-Insights-${companyName}-${date}.pdf`)
    } catch (err) {
      console.error('Error exporting PDF:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-caption text-mid-gray hover:bg-smoke/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download size={14} strokeWidth={1.5} />
      {exporting ? 'Exportando...' : 'Exportar PDF'}
    </button>
  )
}
