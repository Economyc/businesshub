import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Company } from '@/core/types'

interface CompanyLogoProps {
  company: Pick<Company, 'name' | 'color' | 'logo' | 'logoThumb'> | null
  size?: 'sm' | 'md'
  className?: string
}

const sizes = {
  sm: 'w-8 h-8 rounded-md text-xs',
  md: 'w-10 h-10 rounded-lg text-sm',
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

export function CompanyLogo({ company, size = 'sm', className }: CompanyLogoProps) {
  const sizeClass = sizes[size]

  // Use base64 thumbnail if available — instant, no network request
  if (company?.logoThumb) {
    return (
      <img
        src={company.logoThumb}
        alt={company.name}
        className={cn(sizeClass, 'object-cover shrink-0', className)}
      />
    )
  }

  // Fallback to URL-based logo with loading state
  const logoUrl = company?.logo
  const alreadyCached = logoUrl ? loadedUrls.has(logoUrl) : false
  const [loaded, setLoaded] = useState(alreadyCached)

  if (!logoUrl) {
    return <LetterFallback company={company} sizeClass={sizeClass} className={className} />
  }

  return (
    <div className={cn(sizeClass, 'relative shrink-0 overflow-hidden', className)}>
      {!loaded && (
        <div
          className={cn(sizeClass, 'absolute inset-0 bg-[#3d3d3d] text-white flex items-center justify-center font-semibold')}
          style={company?.color ? { backgroundColor: company.color } : undefined}
        >
          {company?.name?.charAt(0) ?? '?'}
        </div>
      )}
      <img
        src={logoUrl}
        alt={company.name}
        className={cn('w-full h-full object-cover', loaded ? 'opacity-100' : 'opacity-0')}
        onLoad={() => { loadedUrls.add(logoUrl); setLoaded(true) }}
      />
    </div>
  )
}
