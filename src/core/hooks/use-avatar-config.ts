import { useState, useCallback } from 'react'
import { cacheGet, cacheSet } from '@/core/utils/cache'

export interface AvatarConfig {
  type: 'initials' | 'icon'
  color: string
  icon?: string
}

const DEFAULT_CONFIG: AvatarConfig = { type: 'initials', color: '#3d3d3d' }

function storageKey(uid: string) {
  return `avatar-${uid}`
}

export function getInitials(displayName: string | null | undefined, email: string | null | undefined): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0].substring(0, 2).toUpperCase()
  }
  if (email) return email[0].toUpperCase()
  return '?'
}

export function useAvatarConfig(uid: string | undefined) {
  const [config, setConfigState] = useState<AvatarConfig>(() => {
    if (!uid) return DEFAULT_CONFIG
    return cacheGet<AvatarConfig>(storageKey(uid)) ?? DEFAULT_CONFIG
  })

  const setConfig = useCallback((next: AvatarConfig) => {
    setConfigState(next)
    if (uid) cacheSet(storageKey(uid), next)
  }, [uid])

  return { config, setConfig }
}
