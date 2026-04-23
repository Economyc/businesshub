import Papa from 'papaparse'

const loadXLSX = () => import('xlsx')

/**
 * Parses an Excel or CSV file and returns a text representation
 * that can be sent to the LLM for categorization.
 */
export async function parseSpreadsheetToText(file: File): Promise<string> {
  if (file.name.endsWith('.csv') || file.type === 'text/csv') {
    return parseCSV(file)
  }
  return parseExcel(file)
}

async function parseExcel(file: File): Promise<string> {
  const XLSX = await loadXLSX()
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const parts: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    if (rows.length === 0) continue

    parts.push(`## Hoja: ${sheetName} (${rows.length} filas)`)

    // Show headers
    const headers = Object.keys(rows[0])
    parts.push(`Columnas: ${headers.join(', ')}`)
    parts.push('')

    // Show all rows (up to 100 to stay within token limits)
    const maxRows = Math.min(rows.length, 100)
    for (let i = 0; i < maxRows; i++) {
      const row = rows[i]
      const values = headers.map((h) => `${h}: ${row[h] ?? ''}`).join(' | ')
      parts.push(`Fila ${i + 1}: ${values}`)
    }

    if (rows.length > maxRows) {
      parts.push(`... y ${rows.length - maxRows} filas más`)
    }

    parts.push('')
  }

  return parts.join('\n')
}

function parseCSV(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[]
        if (rows.length === 0) {
          resolve('El archivo CSV está vacío.')
          return
        }

        const parts: string[] = []
        const headers = Object.keys(rows[0])
        parts.push(`## Archivo CSV (${rows.length} filas)`)
        parts.push(`Columnas: ${headers.join(', ')}`)
        parts.push('')

        const maxRows = Math.min(rows.length, 100)
        for (let i = 0; i < maxRows; i++) {
          const row = rows[i]
          const values = headers.map((h) => `${h}: ${row[h] ?? ''}`).join(' | ')
          parts.push(`Fila ${i + 1}: ${values}`)
        }

        if (rows.length > maxRows) {
          parts.push(`... y ${rows.length - maxRows} filas más`)
        }

        resolve(parts.join('\n'))
      },
      error: (err) => reject(err),
    })
  })
}
