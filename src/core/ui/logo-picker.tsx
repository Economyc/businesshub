import { useState, useEffect, useRef } from 'react'
import { ref as storageRef, uploadBytes, getDownloadURL, listAll } from 'firebase/storage'
import { Upload, ImageIcon, X, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { storage } from '@/core/firebase/config'
import { fileToBase64Thumb } from '@/core/utils/image'

interface LogoPickerProps {
  value: string
  onChange: (url: string, thumb?: string) => void
  companyId: string
}

// Module-level cache so logos persist across open/close and re-renders
let logosCache: string[] | null = null

export function LogoPicker({ value, onChange, companyId }: LogoPickerProps) {
  const [open, setOpen] = useState(false)
  const [logos, setLogos] = useState<string[]>(logosCache ?? [])
  const [loadingLogos, setLoadingLogos] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [open])

  // Load existing logos from Storage when opened
  useEffect(() => {
    if (!open) return
    // If we already have cached logos, show them instantly and refresh in background
    if (logosCache) {
      setLogos(logosCache)
    }
    let cancelled = false
    async function load() {
      // Only show spinner on first load (no cache)
      if (!logosCache) setLoadingLogos(true)
      try {
        const logosRoot = storageRef(storage, 'logos')
        const rootResult = await listAll(logosRoot)
        // List all subdirectories in parallel
        const folderPromises = rootResult.prefixes.map((folder) => listAll(folder))
        const folderResults = await Promise.all(folderPromises)
        // Collect all items and get URLs in parallel
        const allItems = [
          ...rootResult.items,
          ...folderResults.flatMap((r) => r.items),
        ]
        const urls = await Promise.all(allItems.map((item) => getDownloadURL(item)))
        if (!cancelled) {
          const deduped = [...new Set(urls)]
          logosCache = deduped
          setLogos(deduped)
        }
      } catch (err) {
        console.error('Error loading logos:', err)
      } finally {
        if (!cancelled) setLoadingLogos(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [open])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fileRef = storageRef(storage, `logos/${companyId}/${file.name}`)
      // Generate thumbnail in parallel with upload
      const [thumb] = await Promise.all([
        fileToBase64Thumb(file),
        uploadBytes(fileRef, file),
      ])
      const url = await getDownloadURL(fileRef)
      const updated = [url, ...logos.filter((u) => u !== url)]
      logosCache = updated
      setLogos(updated)
      onChange(url, thumb)
      setOpen(false)
    } catch (err) {
      console.error('Error uploading logo:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function selectLogo(url: string) {
    onChange(url)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-10 h-10 rounded-[10px] border border-input-border bg-bone/30 flex items-center justify-center overflow-hidden shrink-0 hover:border-graphite/30 transition-colors cursor-pointer"
        >
          {value ? (
            <img src={value} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={18} strokeWidth={1.5} className="text-mid-gray/40" />
          )}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-caption text-mid-gray hover:text-red-500 transition-colors"
          >
            Quitar
          </button>
        )}
      </div>

      {/* Picker card */}
      {open && (
        <div className="absolute top-12 left-0 z-50 w-72 bg-surface-elevated rounded-xl border border-border shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-body font-medium text-graphite">Seleccionar logo</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Upload button */}
          <div className="px-4 pt-3 pb-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border text-caption font-medium text-mid-gray hover:text-graphite hover:border-graphite hover:bg-bone/50 transition-all disabled:opacity-50"
            >
              {uploading ? (
                <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Subiendo...</>
              ) : (
                <><Upload size={13} strokeWidth={1.5} /> Subir nuevo logo</>
              )}
            </button>
          </div>

          {/* Existing logos grid */}
          <div className="px-4 pb-3">
            {loadingLogos ? (
              <div className="flex items-center justify-center py-4 text-mid-gray">
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              </div>
            ) : logos.length === 0 ? (
              <p className="text-center text-caption text-mid-gray py-3">No hay logos guardados</p>
            ) : (
              <>
                <p className="text-caption uppercase tracking-wider text-mid-gray mb-2">Logos existentes</p>
                <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto">
                  {logos.map((url) => {
                    const isSelected = url === value
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() => selectLogo(url)}
                        className={cn(
                          'relative w-full aspect-square rounded-lg border overflow-hidden transition-all hover:shadow-md',
                          isSelected
                            ? 'border-graphite ring-2 ring-graphite/20'
                            : 'border-border hover:border-graphite/30'
                        )}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-graphite/20 flex items-center justify-center">
                            <Check size={14} strokeWidth={2.5} className="text-white drop-shadow" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
