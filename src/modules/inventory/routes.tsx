import { lazy } from 'react'

export const InventoryPage = lazy(() =>
  import('./components/inventory-page').then((m) => ({ default: m.InventoryPage })),
)
