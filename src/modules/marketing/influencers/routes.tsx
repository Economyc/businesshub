import { lazy } from 'react'

export const InfluencerList = lazy(() => import('./components/influencer-list').then(m => ({ default: m.InfluencerList })))
