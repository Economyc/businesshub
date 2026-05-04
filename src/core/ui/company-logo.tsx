import { useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import type { Company } from '@/core/types'

interface CompanyLogoProps {
  company: Pick<Company, 'name' | 'color' | 'logo' | 'logoThumb'> | null
  size?: 'sm' | 'md' | 'xl'
  className?: string
  imgStyle?: CSSProperties
}

const sizes = {
  sm: 'w-8 h-8 rounded-md text-xs',
  md: 'w-10 h-10 rounded-lg text-sm',
  xl: 'w-20 h-20 rounded-full text-[28px]',
}

// Pixeles para el atributo width/height del <img>. Pre-reserva el espacio
// antes de que cargue la imagen y evita CLS (Cumulative Layout Shift) — el
// navegador conoce la aspect-ratio sin esperar al network request.
const sizesPx = {
  sm: 32,
  md: 40,
  xl: 80,
}

const loadedUrls = new Set<string>()

function LetterFallback({ company, sizeClass, className }: { company: CompanyLogoProps['company']; sizeClass: string; className?: string }) {
  return (
    <div
      className={cn(sizeClass, 'bg-[#3d3d3d] text-white flex items-center justify-center font-semibold shrink-0', className)}
      style={company?.color ? { backgroundColor: company.color } : undefined}
    >
      {company?.name?.charAt(0) ?? '?'}
    </div>
  )
}

export function CompanyLogo({ company, size = 'sm', className, imgStyle }: CompanyLogoProps) {
  const sizeClass = sizes[size]
  const px = sizesPx[size]
  // El thumbnail base64 es ~40px — nítido a sm/md, borroso al escalarlo a 80px.
  // En xl preferimos la URL completa y usamos el thumb solo como placeholder.
  const preferFullLogo = size === 'xl'

  const logoUrl = company?.logo
  const alreadyCached = logoUrl ? loadedUrls.has(logoUrl) : false
  const [loaded, setLoaded] = useState(alreadyCached)

  if (!preferFullLogo && company?.logoThumb) {
    return (
      <img
        src={company.logoThumb}
        alt={company.name}
        width={px}
        height={px}
        className={cn(sizeClass, 'object-cover shrink-0', className)}
      />
    )
  }

  if (!logoUrl && !company?.logoThumb) {
    return <LetterFallback company={company} sizeClass={sizeClass} className={className} />
  }

  // xl sin URL: caer al thumb (mejor que letter aunque se vea pixelado)
  if (!logoUrl && company?.logoThumb) {
    return (
      <img
        src={company.logoThumb}
        alt={company.name}
        width={px}
        height={px}
        className={cn(sizeClass, 'object-cover shrink-0', className)}
      />
    )
  }

  return (
    <div className={cn(sizeClass, 'relative shrink-0 overflow-hidden', className)}>
      {!loaded && (
        company?.logoThumb ? (
          <img
            src={company.logoThumb}
            alt=""
            aria-hidden
            width={px}
            height={px}
            className="absolute inset-0 w-full h-full object-cover rounded-full blur-sm scale-105"
          />
        ) : (
          <div
            className={cn(sizeClass, 'absolute inset-0 bg-[#3d3d3d] text-white flex items-center justify-center font-semibold')}
            style={company?.color ? { backgroundColor: company.color } : undefined}
          >
            {company?.name?.charAt(0) ?? '?'}
          </div>
        )
      )}
      <img
        src={logoUrl!}
        alt={company?.name ?? ''}
        width={px}
        height={px}
        style={imgStyle}
        className={cn('w-full h-full object-cover relative', loaded ? 'opacity-100' : 'opacity-0')}
        onLoad={() => { if (logoUrl) loadedUrls.add(logoUrl); setLoaded(true) }}
      />
    </div>
  )
}
