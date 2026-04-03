import { lazy } from 'react'

export const AgentPage = lazy(() => import('./components/agent-page').then(m => ({ default: m.AgentPage })))
