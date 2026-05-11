import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type DragEvent } from 'react'
import { Send, Paperclip, Square, X, FileSpreadsheet, Image as ImageIcon, AlertCircle, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HoverHint } from '@/components/ui/tooltip'
import { isImageFile, isSpreadsheetFile, isPdfFile } from '../utils/image-preprocessing'
import { validateImageFile, formatImageError } from '../utils/image-validation'
import {
  filterSlashCommands,
  parseSlashCommand,
  type SlashCommand,
} from '../utils/slash-commands'
import { SlashCommandMenu } from './slash-command-menu'
import {
  createVoiceRecorder,
  isVoiceRecognitionSupported,
  type VoiceRecorderHandle,
  type VoiceRecorderState,
} from '../utils/voice-recorder'

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
  const [attachErrors, setAttachErrors] = useState<string[]>([])
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Slash command popover state
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashActiveIndex, setSlashActiveIndex] = useState(0)

  // Voice input (Web Speech API)
  const voiceSupported = useMemo(() => isVoiceRecognitionSupported(), [])
  const [voiceState, setVoiceState] = useState<VoiceRecorderState>(voiceSupported ? 'idle' : 'unavailable')
  const voiceRecorderRef = useRef<VoiceRecorderHandle | null>(null)
  const isRecording = voiceState === 'recording' || voiceState === 'requesting'

  // Sincroniza visibilidad y query a partir del valor del input.
  useEffect(() => {
    if (!input.startsWith('/')) {
      if (slashOpen) setSlashOpen(false)
      return
    }
    const rest = input.slice(1)
    // Cierra cuando el usuario ya escribio un espacio (ya pico comando + args).
    if (rest.includes(' ')) {
      if (slashOpen) setSlashOpen(false)
      return
    }
    setSlashOpen(true)
    setSlashQuery(rest)
  }, [input, slashOpen])

  // Reset del activeIndex cuando cambia la query (mantiene 0 al re-filtrar).
  useEffect(() => {
    setSlashActiveIndex(0)
  }, [slashQuery])

  function handleSelectSlashCommand(cmd: SlashCommand) {
    const parsed = parseSlashCommand(input)
    const args = parsed?.args ?? ''
    if (args) {
      // El usuario ya tipeo args -> expandimos el template completo.
      const expanded = cmd.template(args)
      onInputChange(expanded)
      setSlashOpen(false)
      requestAnimationFrame(() => {
        const ta = textareaRef.current
        if (ta) {
          ta.focus()
          ta.style.height = 'auto'
          ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
        }
      })
    } else {
      // Sin args -> dejamos "/<name> " para que complete.
      onInputChange(`/${cmd.name} `)
      setSlashOpen(false)
      requestAnimationFrame(() => {
        const ta = textareaRef.current
        if (ta) {
          ta.focus()
          const len = ta.value.length
          ta.setSelectionRange(len, len)
        }
      })
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Navegacion del menu de slash commands cuando esta abierto.
    if (slashOpen) {
      const visible = filterSlashCommands(slashQuery)
      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashOpen(false)
        return
      }
      if (e.key === 'ArrowDown' && visible.length > 0) {
        e.preventDefault()
        setSlashActiveIndex((prev) => (prev + 1) % visible.length)
        return
      }
      if (e.key === 'ArrowUp' && visible.length > 0) {
        e.preventDefault()
        setSlashActiveIndex((prev) => (prev - 1 + visible.length) % visible.length)
        return
      }
      if (e.key === 'Tab' && visible.length > 0) {
        e.preventDefault()
        const safeIdx = Math.min(slashActiveIndex, visible.length - 1)
        handleSelectSlashCommand(visible[safeIdx])
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && visible.length > 0) {
        e.preventDefault()
        const safeIdx = Math.min(slashActiveIndex, visible.length - 1)
        handleSelectSlashCommand(visible[safeIdx])
        return
      }
    }

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

  function showAttachErrors(messages: string[]) {
    if (messages.length === 0) return
    setAttachErrors(messages)
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    errorTimeoutRef.current = setTimeout(() => setAttachErrors([]), 6000)
  }

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files)
    const errors: string[] = []
    const accepted: File[] = []

    for (const file of incoming) {
      if (isImageFile(file)) {
        const err = validateImageFile(file)
        if (err) {
          errors.push(`${file.name}: ${formatImageError(err)}`)
          continue
        }
        accepted.push(file)
      } else if (isSpreadsheetFile(file)) {
        accepted.push(file)
      } else if (isPdfFile(file)) {
        if (file.size > 10 * 1024 * 1024) {
          errors.push(`${file.name}: PDF excede 10 MB`)
          continue
        }
        accepted.push(file)
      }
      // Cualquier otro tipo se ignora silenciosamente (comportamiento previo).
    }

    if (accepted.length > 0) {
      setAttachedFiles((prev) => [...prev, ...accepted])
    }
    showAttachErrors(errors)
  }

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
      // Asegura que cualquier dictado activo se detenga al desmontar.
      voiceRecorderRef.current?.stop()
    }
  }, [])

  function handleVoiceClick() {
    if (!voiceSupported) return
    // Toggle: si esta grabando -> detener; si esta idle -> iniciar.
    if (isRecording) {
      voiceRecorderRef.current?.stop()
      return
    }

    // Snapshot del texto actual: el transcript se anade despues de un separador.
    const prefix = input.length > 0 && !input.endsWith(' ') ? input + ' ' : input

    const recorder = createVoiceRecorder({
      lang: 'es-CO',
      onTranscript: (text, _isFinal) => {
        onInputChange(prefix + text)
        // Reajusta altura del textarea al crecer el contenido.
        requestAnimationFrame(() => handleTextareaInput())
      },
      onError: (msg) => {
        showAttachErrors([msg])
      },
      onStateChange: (next) => {
        setVoiceState(next)
      },
    })

    if (!recorder) {
      setVoiceState('unavailable')
      return
    }
    voiceRecorderRef.current = recorder
    recorder.start()
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
      {/* Errores de adjuntos (validación de imágenes) */}
      {attachErrors.length > 0 && (
        <div className="px-3 pt-3">
          <div className="rounded-lg border border-border/60 bg-negative-bg px-4 py-2 flex items-start gap-2">
            <AlertCircle size={14} strokeWidth={1.5} className="text-negative-text shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              {attachErrors.map((msg, i) => (
                <p key={i} className="text-caption text-negative-text">
                  {msg}
                </p>
              ))}
            </div>
            <button
              onClick={() => setAttachErrors([])}
              className="text-negative-text hover:opacity-80 transition-opacity shrink-0"
              aria-label="Cerrar"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="px-3 pt-3 flex flex-wrap gap-2">
          {attachedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card-bg border border-border/60 text-caption"
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
        <HoverHint label="Adjuntar archivo (imagen o Excel)">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-mid-gray hover:text-graphite hover:bg-bone transition-colors active:scale-95"
          >
            <Paperclip size={20} strokeWidth={1.5} />
          </button>
        </HoverHint>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) {
              addFiles(e.target.files)
              e.target.value = ''
            }
          }}
        />

        <HoverHint
          label={
            !voiceSupported
              ? 'Dictado no disponible en este navegador'
              : isRecording
                ? 'Detener dictado'
                : 'Dictar por voz'
          }
        >
          <button
            type="button"
            onClick={handleVoiceClick}
            disabled={!voiceSupported}
            aria-pressed={isRecording}
            aria-label={isRecording ? 'Detener dictado por voz' : 'Iniciar dictado por voz'}
            className={cn(
              'shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-colors active:scale-95',
              !voiceSupported && 'text-mid-gray/40 cursor-not-allowed',
              voiceSupported && !isRecording && 'text-mid-gray hover:text-graphite hover:bg-bone',
              isRecording && 'text-negative-text bg-negative-bg animate-pulse',
            )}
          >
            <Mic size={20} strokeWidth={1.5} />
          </button>
        </HoverHint>

        <div className="relative flex-1 bg-surface-elevated border border-border/60 rounded-2xl overflow-visible focus-within:border-mid-gray focus-within:ring-1 focus-within:ring-mid-gray/20 transition-colors">
          <SlashCommandMenu
            open={slashOpen}
            query={slashQuery}
            activeIndex={slashActiveIndex}
            onSelect={handleSelectSlashCommand}
            onHoverIndex={setSlashActiveIndex}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              onInputChange(e.target.value)
              handleTextareaInput()
            }}
            onKeyDown={handleKeyDown}
            placeholder={attachedFiles.length > 0 ? 'Describe qué hacer con el archivo...' : 'Pregunta sobre tus datos... ( / para comandos)'}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent px-4 py-2.5 text-body text-graphite',
              'placeholder:text-mid-gray outline-none',
              'max-h-[120px] min-h-[40px]',
            )}
          />
        </div>

        {isLoading ? (
          <HoverHint label="Detener">
            <button
              type="button"
              onClick={onStop}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors active:scale-95"
            >
              <Square size={18} strokeWidth={1.5} />
            </button>
          </HoverHint>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() && attachedFiles.length === 0}
            className={cn(
              'shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90',
              (input.trim() || attachedFiles.length > 0)
                ? 'bg-dark-graphite text-white hover:opacity-90'
                : 'text-mid-gray/30 cursor-not-allowed'
            )}
          >
            <Send size={18} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {dragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary/30 rounded-xl pointer-events-none z-10">
          <p className="text-body font-medium text-primary">Suelta el archivo aquí</p>
        </div>
      )}
    </div>
  )
}
