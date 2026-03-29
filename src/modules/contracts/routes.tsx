import { lazy } from 'react'

export const TemplateList = lazy(() =>
  import('./components/template-list').then(m => ({ default: m.TemplateList }))
)

export const ContractList = lazy(() =>
  import('./components/contract-list').then(m => ({ default: m.ContractList }))
)

export const ContractGenerate = lazy(() =>
  import('./components/contract-generate').then(m => ({ default: m.ContractGenerate }))
)

export const ContractDetail = lazy(() =>
  import('./components/contract-detail').then(m => ({ default: m.ContractDetail }))
)
