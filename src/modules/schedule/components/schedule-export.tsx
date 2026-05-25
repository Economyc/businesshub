import { useRef, type RefObject } from 'react'
import { saveAs } from 'file-saver'
import { Download, FileSpreadsheet, FileText, Image } from 'lucide-react'
import { ActionMenu } from '@/core/ui/action-menu'
import { exportSheetsToExcel, type SheetSpec } from '@/core/utils/data-transfer'

interface Props {
  targetRef: RefObject<HTMLDivElement | null>
  fileName?: string
  /** Construye las hojas del Excel solo al clickear (lazy, evita trabajo si no se usa). */
  getExcelSheets: () => SheetSpec[]
}

// Botón "Descargar" del horario con menú de formatos. Los empleados no entran a
// la app, así que el horario se comparte/imprime: PDF y PNG son imagen de la
// grilla (html2canvas, ≈250KB cargados solo al exportar); Excel replica la
// grilla con datos estructurados. Usa ActionMenu (no Popover: Base UI no abre
// en App2/Horarios).
export function ScheduleExport({ targetRef, fileName = 'horario', getExcelSheets }: Props) {
  // Los export de imagen tardan ~1–2s y el menú cierra al clickear (sin estado
  // de carga visible); el ref ignora clics concurrentes.
  const exportingRef = useRef(false)

  async function renderCanvas() {
    // html2canvas-pro (no el original): soporta los colores oklch() del Design
    // System (Tailwind v4). El html2canvas clásico lanza al parsear oklch y la
    // exportación de imagen fallaba en silencio.
    const { default: html2canvas } = await import('html2canvas-pro')
    return html2canvas(targetRef.current!, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#faf9f7',
    })
  }

  async function exportPDF() {
    const [canvas, { jsPDF }] = await Promise.all([renderCanvas(), import('jspdf')])
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width, canvas.height],
    })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
    pdf.save(`${fileName}.pdf`)
  }

  async function exportPNG() {
    const canvas = await renderCanvas()
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) saveAs(blob, `${fileName}.png`)
        resolve()
      }, 'image/png')
    })
  }

  async function exportExcel() {
    await exportSheetsToExcel(getExcelSheets(), fileName)
  }

  function run(fn: () => Promise<void>) {
    return async () => {
      if (exportingRef.current || !targetRef.current) return
      exportingRef.current = true
      try {
        await fn()
      } catch (err) {
        // No dejar fallar en silencio: sin esto, un error de render dejaba al
        // usuario sin descarga y sin pista de por qué.
        console.error('Error al exportar el horario:', err)
        alert('No se pudo generar la descarga. Intenta de nuevo.')
      } finally {
        exportingRef.current = false
      }
    }
  }

  return (
    <ActionMenu
      label="Descargar"
      icon={Download}
      variant="secondary"
      items={[
        { label: 'Excel', icon: FileSpreadsheet, onClick: run(exportExcel) },
        { label: 'PDF', icon: FileText, onClick: run(exportPDF) },
        { label: 'PNG', icon: Image, onClick: run(exportPNG) },
      ]}
    />
  )
}
