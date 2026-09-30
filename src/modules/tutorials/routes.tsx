import { lazy } from 'react'

export const TutorialsPage = lazy(() => import('./components/tutorials-page').then(m => ({ default: m.TutorialsPage })))
export const TutorialSectionPage = lazy(() => import('./components/tutorials-page').then(m => ({ default: m.TutorialSectionPage })))
