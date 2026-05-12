import { lazy } from 'react'

export const DiscountsPage = lazy(() => import('./components/discounts-page').then(m => ({ default: m.DiscountsPage })))
