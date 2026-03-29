import { lazy } from 'react'

export const PurchaseList = lazy(() => import('./components/purchase-list').then(m => ({ default: m.PurchaseList })))
export const PurchaseForm = lazy(() => import('./components/purchase-form').then(m => ({ default: m.PurchaseForm })))
export const PurchaseDetail = lazy(() => import('./components/purchase-detail').then(m => ({ default: m.PurchaseDetail })))
export const ProductList = lazy(() => import('./components/product-list').then(m => ({ default: m.ProductList })))
export const ProductDetail = lazy(() => import('./components/product-detail').then(m => ({ default: m.ProductDetail })))
export const PurchaseDashboard = lazy(() => import('./components/purchase-dashboard').then(m => ({ default: m.PurchaseDashboard })))
