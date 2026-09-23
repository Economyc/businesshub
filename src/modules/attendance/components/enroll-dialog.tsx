import { useRef, useState } from 'react'
import { Camera, Loader2, RotateCcw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useCamera, captureFrame, canvasToDataUrl, fileToCanvas, CAMERA_ERROR } from '../camera'
import { describeFace, euclidean, DESCRIBE_ERROR } from '../face'
import { useEnrollFace } from '../hooks'
import type { FaceProfile } from '../types'

/** Mismo umbral que usa el servidor para reconocer: si la selfie nueva queda
 *  asi de cerca de otro empleado, el sistema los confundiria al marcar. */
const SAME_PERSON_DISTANCE = 0.5

interface EnrollDialogProps {
  employee: { id: string; name: string } | null
  profiles: FaceProfile[]
  onClose: () => void
}

/** `mirrored`: la foto de camara se muestra en espejo (como la ve el empleado);
 *  una foto subida se muestra tal cual. */
type Captured = { descriptor: number[]; thumb: string; mirrored: boolean }

export function EnrollDialog({ employee, profiles, onClose }: EnrollDialogProps) {
  const open = employee !== null
  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        {employee && <EnrollBody key={employee.id} employee={employee} profiles={profiles} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function EnrollBody({ employee, profiles, onClose }: { employee: { id: string; name: string }; profiles: FaceProfile[]; onClose: () => void }) {
  const [captured, setCaptured] = useState<Captured | null>(null)
  const { videoRef, status } = useCamera(captured === null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enroll = useEnrollFace()
  const fileRef = useRef<HTMLInputElement>(null)

  function takePhoto() {
    const video = videoRef.current
    if (!video) return
    void analyze(() => Promise.resolve(captureFrame(video)), true)
  }

  // Foto existente (p.ej. las selfies que ya se tenian en Clonk).
  function uploadPhoto(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    void analyze(() => fileToCanvas(file, 1280), false)
  }

  async function analyze(getFrame: () => Promise<HTMLCanvasElement>, mirrored: boolean) {
    setBusy(true)
    setError(null)
    try {
      const frame = await getFrame()
      const result = await describeFace(frame, { single: true })
      if (!result.ok) {
        setError(DESCRIBE_ERROR[result.reason])
        return
      }
      const clash = profiles.find(
        (p) => p.id !== employee.id && p.descriptors.some((d) => euclidean(d.v, result.descriptor) < SAME_PERSON_DISTANCE),
      )
      if (clash) {
        setError(`Esta cara se parece demasiado a la de ${clash.employeeName}, que ya está registrado. Si es la misma persona, quita primero ese registro.`)
        return
      }
      setCaptured({ descriptor: result.descriptor, thumb: canvasToDataUrl(frame, 160, 0.8), mirrored })
    } catch {
      setError('No se pudo cargar el reconocimiento facial. Revisa la conexión a internet e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!captured) return
    setError(null)
    try {
      await enroll.mutateAsync({ employeeId: employee.id, employeeName: employee.name, ...captured })
      onClose()
    } catch {
      setError('No se pudo guardar el registro. Intenta de nuevo.')
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Registrar a {employee.name}</DialogTitle>
        <DialogDescription>
          Una selfie de frente, con buena luz y sin gafas oscuras. Tómala con la cámara o sube una foto que ya tengas. Con esta foto el sistema lo reconoce al marcar.
        </DialogDescription>
      </DialogHeader>

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border/60 bg-smoke">
        {captured ? (
          <img src={captured.thumb} alt="" className={captured.mirrored ? 'h-full w-full object-cover -scale-x-100' : 'h-full w-full object-cover'} />
        ) : (
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover -scale-x-100" />
        )}
        {!captured && status !== 'ready' && !busy && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-body text-mid-gray">
            {status === 'starting' ? <Loader2 className="animate-spin" size={20} strokeWidth={1.5} /> : CAMERA_ERROR[status]}
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-negative-bg p-4 text-body text-negative-text">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        {captured ? (
          <>
            <Button variant="outline" onClick={() => { setCaptured(null); setError(null) }}>
              <RotateCcw size={16} strokeWidth={1.5} /> Repetir
            </Button>
            <Button onClick={save} disabled={enroll.isPending}>
              {enroll.isPending && <Loader2 className="animate-spin" size={16} strokeWidth={1.5} />}
              Guardar registro
            </Button>
          </>
        ) : (
          <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={16} strokeWidth={1.5} /> Subir foto
          </Button>
          <Button onClick={takePhoto} disabled={busy || status !== 'ready'}>
            {busy ? <Loader2 className="animate-spin" size={16} strokeWidth={1.5} /> : <Camera size={16} strokeWidth={1.5} />}
            {busy ? 'Analizando…' : 'Tomar foto'}
          </Button>
          </>
        )}
      </DialogFooter>
    </>
  )
}
