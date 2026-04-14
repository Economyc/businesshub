import { useState } from 'react'
import {
  Palette, ChevronRight,
  CircleUser, User, UserRound, Smile, Heart,
  Star, Zap, Crown, Gem, Shield,
  Flame, Rocket, Coffee, Music,
  Code, Terminal, Lightbulb, Sparkles, Ghost,
  Cat, Dog, Bird, Fish, Flower2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AvatarConfig } from '@/core/hooks/use-avatar-config'

const AVATAR_COLORS = [
  '#3d3d3d', '#64748b', '#78716c', '#be123c', '#c2410c',
  '#b45309', '#047857', '#0f766e', '#1d4ed8', '#6d28d9',
] as const

const AVATAR_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: 'CircleUser', icon: CircleUser },
  { name: 'User', icon: User },
  { name: 'UserRound', icon: UserRound },
  { name: 'Smile', icon: Smile },
  { name: 'Heart', icon: Heart },
  { name: 'Star', icon: Star },
  { name: 'Zap', icon: Zap },
  { name: 'Crown', icon: Crown },
  { name: 'Gem', icon: Gem },
  { name: 'Shield', icon: Shield },
  { name: 'Flame', icon: Flame },
  { name: 'Rocket', icon: Rocket },
  { name: 'Coffee', icon: Coffee },
  { name: 'Music', icon: Music },
  { name: 'Palette', icon: Palette },
  { name: 'Code', icon: Code },
  { name: 'Terminal', icon: Terminal },
  { name: 'Lightbulb', icon: Lightbulb },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Ghost', icon: Ghost },
  { name: 'Cat', icon: Cat },
  { name: 'Dog', icon: Dog },
  { name: 'Bird', icon: Bird },
  { name: 'Fish', icon: Fish },
  { name: 'Flower2', icon: Flower2 },
]

interface AvatarPickerProps {
  config: AvatarConfig
  onConfigChange: (config: AvatarConfig) => void
}

export function AvatarPicker({ config, onConfigChange }: AvatarPickerProps) {
  const [expanded, setExpanded] = useState(false)

  function setColor(color: string) {
    onConfigChange({ ...config, color })
  }

  function setType(type: 'initials' | 'icon') {
    const next: AvatarConfig = { ...config, type }
    if (type === 'icon' && !next.icon) next.icon = 'CircleUser'
    onConfigChange(next)
  }

  function setIcon(name: string) {
    onConfigChange({ ...config, type: 'icon', icon: name })
  }

  return (
    <div>
      {/* Trigger row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label="Personalizar avatar"
        className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg text-body text-mid-gray hover:text-dark-graphite transition-colors duration-150"
      >
        <Palette size={16} strokeWidth={1.5} />
        <span className="flex-1 text-left">Personalizar avatar</span>
        <ChevronRight
          size={14}
          strokeWidth={1.5}
          className={cn('transition-transform duration-200', expanded && 'rotate-90')}
        />
      </button>

      {/* Expandable content */}
      <div
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pt-1 pb-3 space-y-3">
            {/* Type toggle (segmented control) */}
            <div className="flex bg-smoke rounded-md p-0.5 gap-0.5" role="radiogroup" aria-label="Tipo de avatar">
              <button
                type="button"
                role="radio"
                aria-checked={config.type === 'initials'}
                onClick={() => setType('initials')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-caption transition-all duration-150',
                  config.type === 'initials'
                    ? 'bg-surface-elevated text-dark-graphite shadow-sm'
                    : 'text-mid-gray hover:text-graphite'
                )}
              >
                <span className="font-semibold text-caption">Aa</span>
                Iniciales
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={config.type === 'icon'}
                onClick={() => setType('icon')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-caption transition-all duration-150',
                  config.type === 'icon'
                    ? 'bg-surface-elevated text-dark-graphite shadow-sm'
                    : 'text-mid-gray hover:text-graphite'
                )}
              >
                <Star size={12} strokeWidth={1.5} />
                Ícono
              </button>
            </div>

            {/* Color palette */}
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Color del avatar">
              {AVATAR_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={config.color === hex}
                  aria-label={hex}
                  onClick={() => setColor(hex)}
                  className={cn(
                    'w-5 h-5 rounded-full cursor-pointer transition-all duration-150',
                    config.color === hex
                      ? 'ring-2 ring-offset-2 ring-offset-surface-elevated'
                      : 'hover:scale-110'
                  )}
                  style={{
                    backgroundColor: hex,
                    ...(config.color === hex ? { ['--tw-ring-color' as string]: hex } : {}),
                  }}
                />
              ))}
            </div>

            {/* Icon grid (only when type === 'icon') */}
            <div
              className={cn(
                'grid transition-all duration-200 ease-in-out',
                config.type === 'icon' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              )}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Ícono del avatar">
                  {AVATAR_ICONS.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={config.icon === name}
                      aria-label={name}
                      onClick={() => setIcon(name)}
                      className={cn(
                        'w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150',
                        config.icon === name
                          ? 'bg-smoke text-dark-graphite ring-1 ring-border'
                          : 'text-mid-gray hover:bg-smoke hover:text-graphite'
                      )}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
