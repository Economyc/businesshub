// Web Speech API wrapper para dictado por voz en el chat del agente.
// Si el navegador no soporta SpeechRecognition (Firefox, algunos Safari antiguos),
// `createVoiceRecorder` devuelve `null` y el caller debe deshabilitar el boton.

// Tipos minimos: Web Speech API no esta en lib.dom.d.ts en todas las versiones.
interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string
  readonly message?: string
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null
  onend: ((ev: Event) => void) | null
  onstart: ((ev: Event) => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

export type VoiceRecorderState = 'idle' | 'requesting' | 'recording' | 'unavailable' | 'error'

export interface VoiceRecorderHandle {
  start(): void
  stop(): void
  /** Estado actual sincrono (snapshot). Para reactividad usar el callback `onStateChange`. */
  state: VoiceRecorderState
}

export interface VoiceRecorderOptions {
  lang?: 'es-CO' | 'es-ES' | 'en-US'
  /** Se llama con el texto acumulado. `isFinal=true` cuando el motor cierra el segmento. */
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (msg: string) => void
  /** Notifica cambios de estado para que el caller actualice su UI. */
  onStateChange?: (state: VoiceRecorderState) => void
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isVoiceRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

/**
 * Crea un recorder push-to-talk usando Web Speech API.
 * Devuelve `null` si el navegador no soporta la API (caller debe deshabilitar UI).
 *
 * Permisos: la primera llamada a `start()` solicita permiso de microfono al navegador
 * via `navigator.mediaDevices.getUserMedia`. Si el usuario rechaza, se reporta error.
 */
export function createVoiceRecorder(opts: VoiceRecorderOptions): VoiceRecorderHandle | null {
  const CtorOrNull = getSpeechRecognitionCtor()
  if (!CtorOrNull) return null
  const Ctor: SpeechRecognitionCtor = CtorOrNull

  const lang = opts.lang ?? 'es-CO'
  let state: VoiceRecorderState = 'idle'
  let recognition: SpeechRecognitionLike | null = null
  // Texto final acumulado en la sesion actual de grabacion (segmentos cerrados).
  let finalBuffer = ''

  function setState(next: VoiceRecorderState) {
    if (state === next) return
    state = next
    opts.onStateChange?.(next)
  }

  function buildRecognition(): SpeechRecognitionLike {
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const alt = result[0]
        if (!alt) continue
        if (result.isFinal) {
          finalBuffer += alt.transcript
        } else {
          interim += alt.transcript
        }
      }
      const combined = (finalBuffer + interim).trim()
      // `isFinal=true` solo cuando todos los segmentos del evento son finales y no hay interim.
      const allFinal = interim.length === 0
      opts.onTranscript(combined, allFinal)
    }

    rec.onerror = (event) => {
      const code = event.error
      let msg = 'Error de dictado'
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        msg = 'Permisos de microfono denegados'
      } else if (code === 'no-speech') {
        msg = 'No se detecto voz'
      } else if (code === 'audio-capture') {
        msg = 'No se encontro microfono disponible'
      } else if (code === 'network') {
        msg = 'Error de red durante el dictado'
      } else if (code === 'aborted') {
        // Usuario detuvo manualmente — no es error visible.
        setState('idle')
        return
      }
      setState('error')
      opts.onError(msg)
    }

    rec.onend = () => {
      // Si el motor termina por silencio o por final, volvemos a idle.
      if (state === 'recording' || state === 'requesting') {
        setState('idle')
      }
    }

    return rec
  }

  async function ensureMicrophonePermission(): Promise<boolean> {
    // En navegadores que exponen SpeechRecognition pero no mediaDevices, saltamos el chequeo
    // explicito (el propio SpeechRecognition pedira el permiso al iniciar).
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return true
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Cerramos los tracks inmediatamente: solo queriamos el prompt de permiso.
      for (const track of stream.getTracks()) track.stop()
      return true
    } catch {
      setState('error')
      opts.onError('Permisos de microfono denegados')
      return false
    }
  }

  return {
    get state() {
      return state
    },
    async start() {
      if (state === 'recording' || state === 'requesting') return
      setState('requesting')
      const ok = await ensureMicrophonePermission()
      if (!ok) return
      finalBuffer = ''
      try {
        recognition = buildRecognition()
        recognition.onstart = () => setState('recording')
        recognition.start()
      } catch (err) {
        setState('error')
        const msg = err instanceof Error ? err.message : 'No se pudo iniciar el dictado'
        opts.onError(msg)
      }
    },
    stop() {
      if (!recognition) {
        setState('idle')
        return
      }
      try {
        recognition.stop()
      } catch {
        // Ignorar: stop puede lanzar si ya termino.
      }
    },
  }
}
