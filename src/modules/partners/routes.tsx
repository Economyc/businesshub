import { lazy } from 'react'

export const PartnerList = lazy(() => import('./components/partner-list').then(m => ({ default: m.PartnerList })))
