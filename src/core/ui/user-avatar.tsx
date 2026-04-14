import { memo } from 'react'
import {
  CircleUser, User, UserRound, Smile, Heart,
  Star, Zap, Crown, Gem, Shield,
  Flame, Rocket, Coffee, Music, Palette,
  Code, Terminal, Lightbulb, Sparkles, Ghost,
  Cat, Dog, Bird, Fish, Flower2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AvatarConfig } from '@/core/hooks/use-avatar-config'
import { getInitials } from '@/core/hooks/use-avatar-config'

const ICON_MAP: Record<string, LucideIcon> = {
  CircleUser, User, UserRound, Smile, Heart,
  Star, Zap, Crown, Gem, Shield,
  Flame, Rocket, Coffee, Music, Palette,
  Code, Terminal, Lightbulb, Sparkles, Ghost,
  Cat, Dog, Bird, Fish, Flower2,
}

const SIZES = {
  sm: { container: 'w-6 h-6', text: 'text-[10px]', icon: 12 },
  md: { container: 'w-7 h-7', text: 'text-[11px]', icon: 14 },
  lg: { container: 'w-10 h-10', text: 'text-sm font-semibold', icon: 18 },
} as const

interface UserAvatarProps {
  config?: AvatarConfig | null
  displayName?: string | null
  email?: string | null
  size: 'sm' | 'md' | 'lg'
  className?: string
}

export const UserAvatar = memo(function UserAvatar({ config = null, displayName, email, size, className }: UserAvatarProps) {
  const s = SIZES[size]

  if (!config) {
    return (
      <div className={cn(s.container, 'rounded-full bg-graphite/10 flex items-center justify-center shrink-0', className)}>
        <CircleUser size={s.icon} strokeWidth={1.5} className="text-graphite" />
      </div>
    )
  }

  const Icon = config.icon ? ICON_MAP[config.icon] : null

  return (
    <div
      className={cn(s.container, 'rounded-full flex items-center justify-center shrink-0', className)}
      style={{ backgroundColor: config.color }}
    >
      {config.type === 'initials' ? (
        <span className={cn(s.text, 'text-white font-medium leading-none select-none')}>
          {getInitials(displayName, email)}
        </span>
      ) : Icon ? (
        <Icon size={s.icon} strokeWidth={1.5} className="text-white" />
      ) : (
        <CircleUser size={s.icon} strokeWidth={1.5} className="text-white" />
      )}
    </div>
  )
})
