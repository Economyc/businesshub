import { useState, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, FileText, ImageIcon, FileIcon, Trash2, ExternalLink, Download, Loader2 } from 'lucide-react'
import { saveAs } from 'file-saver'
import { queryClient } from '@/core/query/query-client'
import { useCompany } from '@/core/hooks/use-company'
import { SelectInput } from '@/core/ui/select-input'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { EmptyState } from '@/core/ui/empty-state'
import { HoverHint } from '@/components/ui/tooltip'
import { Skeleton } from '@/core/ui/skeleton'
import { useEmployeeDocuments } from '../hooks'
import { talentService } from '../services'
import { DOCUMENT_CATEGORY_LABELS } from '../types'
import type { DocumentCategory, EmployeeDocument } from '../types'
import type { Timestamp } from 'firebase/firestore'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.doc,.docx'

const CATEGORY_OPTIONS = Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '—'
  return ts.toDate().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return ImageIcon
  if (contentType === 'application/pdf') return FileText
  return FileIcon
}

interface Props {
  employeeId: string
}

export function EmployeeDocuments({ employeeId }: Props) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id ?? ''
  const { data: documents, loading } = useEmployeeDocuments(employeeId)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [category, setCategory] = useState<DocumentCategory>('certificado')
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDocument | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const uploadMutation = useMutation({
    mutationFn: ({ file, cat }: { file: File; cat: DocumentCategory }) =>
      talentService.uploadDocument(companyId, employeeId, file, cat),
    onSuccess: () => {
      setPendingFile(null)
      queryClient.invalidateQueries({ queryKey: ['employee-documents', companyId, employeeId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ docId, storagePath }: { docId: string; storagePath: string }) =>
      talentService.deleteDocument(companyId, employeeId, docId, storagePath),
    onSuccess: () => {
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['employee-documents', companyId, employeeId] })
    },
  })

  const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

  const processFile = useCallback((file: File) => {
    if (file.size > MAX_SIZE) {
      alert('El archivo excede el límite de 10 MB.')
      return
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert('Formato no soportado. Usa PDF, JPG, PNG o Word.')
      return
    }
    setPendingFile(file)
    setCategory('certificado')
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  function handleUploadConfirm() {
    if (!pendingFile) return
    uploadMutation.mutate({ file: pendingFile, cat: category })
  }

  async function handleDownload(doc: EmployeeDocument) {
    try {
      const res = await fetch(doc.url)
      const blob = await res.blob()
      saveAs(blob, doc.name)
    } catch {
      window.open(doc.url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Drop zone + upload trigger */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 px-6 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-graphite bg-graphite/5 scale-[1.01]'
            : 'border-mid-gray/30 bg-bone/30 hover:border-mid-gray/50 hover:bg-bone/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 ${
          isDragging ? 'bg-graphite/10' : 'bg-bone'
        }`}>
          <Upload size={22} strokeWidth={1.5} className={`transition-colors duration-200 ${isDragging ? 'text-graphite' : 'text-mid-gray'}`} />
        </div>
        <div className="text-center">
          <p className="text-body font-medium text-graphite">
            {isDragging ? 'Suelta el archivo aquí' : 'Arrastra un archivo o haz clic para subir'}
          </p>
          <p className="text-caption text-mid-gray mt-1">
            PDF, JPG, PNG o Word — máx. 10 MB
          </p>
        </div>
      </div>

      {/* Pending upload card */}
      {pendingFile && (
        <div className="bg-surface rounded-xl card-elevated p-5 space-y-4">
          <p className="text-body text-graphite font-medium">
            Archivo: <span className="font-normal">{pendingFile.name}</span>
            <span className="text-mid-gray ml-2">({formatBytes(pendingFile.size)})</span>
          </p>
          <div className="max-w-xs">
            <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">
              Categoría
            </label>
            <SelectInput
              value={category}
              onChange={(v) => setCategory(v as DocumentCategory)}
              options={CATEGORY_OPTIONS}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleUploadConfirm}
              disabled={uploadMutation.isPending}
              className="px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {uploadMutation.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" /> Subiendo...
                </span>
              ) : (
                'Confirmar'
              )}
            </button>
            <button
              onClick={() => setPendingFile(null)}
              disabled={uploadMutation.isPending}
              className="px-4 py-2 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
            >
              Cancelar
            </button>
          </div>
          {uploadMutation.isError && (
            <p className="text-body text-negative-text">Error al subir el archivo. Intenta de nuevo.</p>
          )}
        </div>
      )}

      {/* Documents list */}
      {documents.length === 0 && !pendingFile ? (
        <EmptyState
          icon={FileText}
          title="Sin documentos"
          description="Sube documentos como cédula, certificados o exámenes médicos al perfil de este empleado."
        />
      ) : (
        <div className="space-y-3">
          {documents.map((d) => {
            const Icon = fileIcon(d.contentType)
            return (
              <div
                key={d.id}
                className="flex items-center gap-4 bg-surface rounded-xl card-elevated px-5 py-4"
              >
                <div className="w-10 h-10 rounded-lg bg-bone/60 flex items-center justify-center shrink-0">
                  <Icon size={20} strokeWidth={1.5} className="text-mid-gray" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body text-graphite font-medium truncate">{d.name}</p>
                  <p className="text-caption text-mid-gray">
                    {DOCUMENT_CATEGORY_LABELS[d.category]} · {formatBytes(d.size)} · {formatDate(d.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <HoverHint label="Vista previa">
                    <button
                      onClick={() => window.open(d.url, '_blank')}
                      className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                    >
                      <ExternalLink size={16} strokeWidth={1.5} />
                    </button>
                  </HoverHint>
                  <HoverHint label="Descargar">
                    <button
                      onClick={() => handleDownload(d)}
                      className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                    >
                      <Download size={16} strokeWidth={1.5} />
                    </button>
                  </HoverHint>
                  <HoverHint label="Eliminar">
                    <button
                      onClick={() => setDeleteTarget(d)}
                      className="p-2 rounded-lg text-mid-gray hover:text-negative-text hover:bg-negative-bg transition-colors"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </HoverHint>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar Documento"
        description={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}"? El archivo se eliminará permanentemente.`}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ docId: deleteTarget.id, storagePath: deleteTarget.storagePath })
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
