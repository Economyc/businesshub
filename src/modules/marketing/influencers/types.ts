import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity } from '@/core/types'

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'twitter' | 'other'

export interface SocialNetwork {
  platform: SocialPlatform
  handle: string
}

export interface ContentChecklist {
  story: boolean
  post: boolean
  reel: boolean
}

export interface LinkedOrder {
  documento: string
  total: number
  fecha: string
  items: string[]
}

export interface InfluencerVisit extends BaseEntity {
  name: string
  socialNetworks: SocialNetwork[]
  visitDate: Timestamp
  order?: LinkedOrder
  content: ContentChecklist
  notes?: string
  status: 'pending' | 'completed'
}

export type InfluencerVisitFormData = Omit<InfluencerVisit, 'id' | 'createdAt' | 'updatedAt'>
