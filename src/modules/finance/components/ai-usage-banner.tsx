import { Sparkles, AlertTriangle } from 'lucide-react'

/** Espejo del tipo devuelto por las callables analyzeInvoiceDocument / analyzePaymentReceipt. */
export interface AiUsageSnapshot {
  monthKey: string
  monthLabel: string
  cloudVisionOcrUsed: number
  cloudVisionFreeMonthly: number
  cloudVisionRemaining: number
  cloudVisionOverFreeTier: boolean
  byProvider: {
    gemini: number
    'groq-scout': number
    'cerebras-llama8b': number
    'groq-llama70b': number
  }
  totalExtractions: number
  totalFailed: number
}

interface AiUsageBannerProps {
  usage: AiUsageSnapshot
  /** Provider que terminó usándose en esta extracción (ej. 'gemini', 'cerebras-llama8b+vision-ocr'). */
  provider?: string
}

export function AiUsageBanner({ usage, provider }: AiUsageBannerProps) {
  const { cloudVisionRemaining, cloudVisionFreeMonthly, cloudVisionOcrUsed, cloudVisionOverFreeTier, monthLabel } = usage
  const providerLabel = provider && provider !== 'none' ? provider : null

  if (cloudVisionOverFreeTier) {
    return (
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warning-bg/50 border border-warning/20 text-caption text-warning-text">
        <AlertTriangle size={13} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <span>
          {providerLabel && <>Vía {providerLabel} · </>}
          OCR Cloud Vision: {cloudVisionOcrUsed}/{cloudVisionFreeMonthly} este mes — fuera del free tier (US$1.50 por 1.000 extra).
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bone/60 border border-border/60 text-caption text-mid-gray">
      <Sparkles size={13} strokeWidth={1.5} className="shrink-0" />
      <span>
        {providerLabel && <>Vía {providerLabel} · </>}
        OCR Cloud Vision: {cloudVisionRemaining}/{cloudVisionFreeMonthly} lecturas gratis disponibles ({monthLabel}).
      </span>
    </div>
  )
}
