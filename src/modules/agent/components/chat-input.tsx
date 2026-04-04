import { useRef, useState, type FormEvent, type KeyboardEvent, type DragEvent } from 'react'
import { Send, Paperclip, Square, X, FileSpreadsheet, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isImageFile, isSpreadsheetFile } from '../utils/image-preprocessing'

interface ChatInputProps {
  input: string
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  onSendWithFiles?: (text: string, files: File[]) => void
  isLoading: boolean
  onStop?: () => void
}

export function ChatInput({ input, onInputChange, onSubmit, onSendWithFiles, isLoading, onStop }: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    if (isLoading) return
    if (!input.trim() && attachedFiles.length === 0) return

    if (attachedFiles.length > 0 && onSendWithFiles) {
      onSendWithFiles(input.trim() || 'Analiza este archivo', attachedFiles)
      setAttachedFiles([])
      onInputChange('')
      resetTextarea()
    } else if (input.trim()) {
      onSubmit(new Event('submit') as unknown as FormEvent)
    }
  }

  function handleTextareaInput() {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
    }
  }

  function resetTextarea() {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
    }
  }

  function addFiles(files: FileList | File[]) {
    const validFiles = Array.from(files).filter(
      (f) => isImageFile(f) || isSpreadsheetFile(f)
    )
    if (validFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...validFiles])
    }
  }

  function removeFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'border-t border-border bg-surface-elevated transition-colors',
        dragOver && 'bg-primary/5 border-primary/30'
      )}
    >
      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="px-3 pt-3 flex flex-wrap gap-2">
          {attachedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card-bg border border-border text-xs"
            >
              {isImageFile(file) ? (
                <ImageIcon size={12} className="text-mid-gray shrink-0" />
              ) : (
                <FileSpreadsheet size={12} className="text-mid-gray shrink-0" />
              )}
              <span className="text-dark-graphite truncate max-w-[120px]">{file.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="text-mid-gray hover:text-destructive transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-mid-gray hover:text-graphite hover:bg-bone transition-colors active:scale-95"
          title="Adjuntar archivo (imagen o Excel)"
        >
          <Paperclip size={20} strokeWidth={1.5} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.xlsx,.xls,.csv"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) {
              addFiles(e.target.files)
              e.target.value = ''
            }
          }}
        />

        <div className="flex-1 bg-surface-elevated border border-input rounded-[20px] shadow-sm overflow-hidden focus-within:border-mid-gray focus-within:ring-1 focus-within:ring-mid-gray/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              onInputChange(e.target.value)
              handleTextareaInput()
            }}
            onKeyDown={handleKeyDown}
            placeholder={attachedFiles.length > 0 ? 'Describe qué hacer con el archivo...' : 'Pregunta sobre tus datos...'}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent px-4 py-[10px] text-sm text-graphite',
              'placeholder:text-mid-gray outline-none',
              'max-h-[120px] min-h-[40px]',
            )}
          />
        </div>

        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors active:scale-95"
            title="Detener"
          >
            <Square size={18} strokeWidth={1.5} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() && attachedFiles.length === 0}
            className={cn(
              'shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90',
              (input.trim() || attachedFiles.length > 0)
                ? 'bg-dark-graphite text-white shadow-sm hover:opacity-90'
                : 'text-mid-gray/30 cursor-not-allowed'
            )}
          >
            <Send size={18} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {dragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary/30 rounded-xl pointer-events-none z-10">
          <p className="text-sm text-primary font-medium">Suelta el archivo aquí</p>
        </div>
      )}
    </div>
  )
}
