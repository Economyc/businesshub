# BusinessHub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified command center SPA for managing four independent companies with talent, suppliers, finance, and insights modules.

**Architecture:** Monolito modular React + Vite with Firebase/Firestore backend. Each business module (talent, suppliers, finance, insights) is self-contained under `src/modules/` with its own components, hooks, services, and types. A shared `core/` layer provides Firebase config, the company context, the design system layout components, and reusable hooks.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, Shadcn/ui, Framer Motion, Lucide React, Firebase/Firestore, Recharts, React Router v6, PapaParse, xlsx, jsPDF, html2canvas

**Spec:** `docs/superpowers/specs/2026-03-19-businesshub-design.md`

---

## File Structure

```
businesshub/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── .env.local                          — Firebase config (not committed)
├── .gitignore
├── components.json                     — Shadcn/ui config
├── src/
│   ├── main.tsx                        — Entry point, renders App
│   ├── App.tsx                         — Router + CompanyProvider + Layout
│   ├── index.css                       — Tailwind directives + Inter font + custom tokens
│   ├── lib/
│   │   └── utils.ts                    — cn() helper (from Shadcn)
│   ├── core/
│   │   ├── firebase/
│   │   │   ├── config.ts              — Firebase app init from env vars
│   │   │   └── helpers.ts             — Typed Firestore CRUD helpers (getDoc, addDoc, etc.)
│   │   ├── hooks/
│   │   │   ├── use-company.ts         — useCompany hook (reads CompanyContext)
│   │   │   └── use-firestore.ts       — Generic useCollection / useDocument hooks
│   │   ├── types/
│   │   │   └── index.ts              — Company, BaseEntity, Status types
│   │   ├── ui/
│   │   │   ├── layout.tsx            — Main layout: Topbar + Sidebar + content slot
│   │   │   ├── topbar.tsx            — Logo, CompanySelector pills, user avatar
│   │   │   ├── sidebar.tsx           — Vertical nav with Lucide icons
│   │   │   ├── company-provider.tsx  — CompanyContext provider + selector state
│   │   │   ├── kpi-card.tsx          — Reusable KPI card with animated count-up
│   │   │   ├── data-table.tsx        — Reusable table component with sorting
│   │   │   ├── status-badge.tsx      — Badge component for status display
│   │   │   ├── page-header.tsx       — Page title + action buttons header
│   │   │   ├── search-input.tsx      — Search input with Lucide Search icon
│   │   │   ├── empty-state.tsx       — Empty state placeholder
│   │   │   ├── confirm-dialog.tsx    — Delete confirmation modal
│   │   │   └── page-transition.tsx   — Framer Motion wrapper for route transitions
│   │   └── animations/
│   │       └── variants.ts           — Shared Framer Motion animation variants
│   ├── modules/
│   │   ├── talent/
│   │   │   ├── types.ts              — Employee type
│   │   │   ├── services.ts           — Firestore CRUD for employees
│   │   │   ├── hooks.ts              — useEmployees, useEmployee
│   │   │   ├── routes.tsx            — Lazy route definitions
│   │   │   └── components/
│   │   │       ├── employee-list.tsx  — Table with search/filter
│   │   │       ├── employee-form.tsx  — Create/edit form
│   │   │       └── employee-profile.tsx — Detail view with inline edit
│   │   ├── suppliers/
│   │   │   ├── types.ts              — Supplier type
│   │   │   ├── services.ts           — Firestore CRUD for suppliers
│   │   │   ├── hooks.ts              — useSuppliers, useSupplier
│   │   │   ├── routes.tsx            — Lazy route definitions
│   │   │   └── components/
│   │   │       ├── supplier-list.tsx  — Table with search/filter + contract alerts
│   │   │       ├── supplier-form.tsx  — Create/edit form
│   │   │       └── supplier-detail.tsx — Detail view with inline edit
│   │   ├── finance/
│   │   │   ├── types.ts              — Transaction type
│   │   │   ├── services.ts           — Firestore CRUD for transactions
│   │   │   ├── hooks.ts              — useTransactions, useFinanceSummary
│   │   │   ├── routes.tsx            — Lazy route definitions
│   │   │   └── components/
│   │   │       ├── transaction-list.tsx — Table with filters (category, type, status, date range)
│   │   │       ├── transaction-form.tsx — Create/edit transaction
│   │   │       ├── finance-summary.tsx  — Income/expense/balance cards
│   │   │       └── import-view.tsx      — CSV/Excel import with validation
│   │   └── insights/
│   │       ├── types.ts              — KPI, Trend types
│   │       ├── services.ts           — Firestore read/write for KPIs
│   │       ├── hooks.ts              — useKPIs, useTrends
│   │       ├── routes.tsx            — Lazy route definitions
│   │       └── components/
│   │           ├── kpi-dashboard.tsx  — Main insights page with all KPI cards
│   │           ├── trend-chart.tsx    — Monthly trend line chart (Recharts)
│   │           ├── category-breakdown.tsx — Horizontal bar chart by expense category
│   │           └── export-pdf.tsx     — PDF export button + logic
│   └── components/
│       └── ui/                        — Shadcn/ui components (auto-generated)
│           ├── button.tsx
│           ├── input.tsx
│           ├── dialog.tsx
│           ├── select.tsx
│           ├── table.tsx
│           └── ...
```

---

## Task 1: Project Scaffolding & Tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `.gitignore`, `.env.local`, `src/main.tsx`, `src/index.css`, `src/App.tsx`, `src/lib/utils.ts`

- [ ] **Step 1: Initialize Vite + React + TypeScript project**

Run:
```bash
cd "E:/Python and IA/Empresas/BuisinessHub"
npm create vite@latest . -- --template react-ts
```

If prompted about non-empty directory, confirm yes.

- [ ] **Step 2: Install core dependencies**

Run:
```bash
npm install react-router-dom firebase framer-motion lucide-react recharts papaparse xlsx jspdf html2canvas
npm install -D tailwindcss @tailwindcss/vite @types/papaparse
```

- [ ] **Step 3: Configure Tailwind with custom design tokens**

Replace `src/index.css` with:
```css
@import "tailwindcss";

@theme {
  --color-bone: #f5f3f0;
  --color-smoke: #edebe8;
  --color-mid-gray: #8a8a8a;
  --color-graphite: #3d3d3d;
  --color-dark-graphite: #2d2d2d;
  --color-card-bg: #faf9f7;
  --color-border: #eeece9;
  --color-border-hover: #d5d3d0;
  --color-input-border: #e2e0dc;
  --color-input-focus: #b0ada8;
  --color-positive-bg: #e8f0e8;
  --color-positive-text: #5a7a5a;
  --color-warning-bg: #f0ece4;
  --color-warning-text: #8a7a5a;
  --color-negative-bg: #f0e8e8;
  --color-negative-text: #9a6a6a;
  --color-info-bg: #e8ecf0;
  --color-info-text: #5a6a8a;

  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;

  --text-heading: 18px;
  --text-subheading: 14px;
  --text-body: 13px;
  --text-caption: 11px;
  --text-kpi: 22px;
}

@layer base {
  body {
    @apply bg-bone text-graphite font-sans antialiased;
    font-size: var(--text-body);
    line-height: 1.6;
  }
}
```

Update `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Update `tsconfig.app.json` to add path alias:
```json
{
  "compilerOptions": {
    ...existing options...,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 4: Initialize Shadcn/ui**

Run:
```bash
npx shadcn@latest init
```

Choose: New York style, Zinc color, CSS variables = yes. Then install base components:
```bash
npx shadcn@latest add button input dialog select table
```

- [ ] **Step 5: Create utility helper**

Create `src/lib/utils.ts`:
```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Note: Shadcn init may already create this file. If so, skip.

- [ ] **Step 6: Create .env.local template and .gitignore**

Create `.env.local`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Ensure `.gitignore` includes:
```
node_modules
dist
.env.local
.env
.superpowers
```

- [ ] **Step 7: Verify dev server starts**

Run:
```bash
npm run dev
```

Expected: Vite dev server starts on localhost with no errors.

- [ ] **Step 8: Initialize git and commit**

Run:
```bash
git init
git add .
git commit -m "chore: scaffold Vite + React + TS + Tailwind + Shadcn project"
```

---

## Task 2: Firebase Configuration & Core Helpers

**Files:**
- Create: `src/core/firebase/config.ts`, `src/core/firebase/helpers.ts`, `src/core/types/index.ts`

- [ ] **Step 1: Create Firebase config**

Create `src/core/firebase/config.ts`:
```ts
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
```

- [ ] **Step 2: Create shared types**

Create `src/core/types/index.ts`:
```ts
import { Timestamp } from 'firebase/firestore'

export interface Company {
  id: string
  name: string
  slug: string
  createdAt: Timestamp
}

export interface BaseEntity {
  id: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type Status = 'active' | 'inactive'
export type SupplierStatus = 'active' | 'expired' | 'pending'
export type TransactionType = 'income' | 'expense'
export type TransactionStatus = 'paid' | 'pending' | 'overdue'
```

- [ ] **Step 3: Create Firestore typed helpers**

Create `src/core/firebase/helpers.ts`:
```ts
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  Timestamp,
  type QueryConstraint,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './config'

export function companyCollection(companyId: string, collectionName: string) {
  return collection(db, 'companies', companyId, collectionName)
}

export function companyDoc(companyId: string, collectionName: string, docId: string) {
  return doc(db, 'companies', companyId, collectionName, docId)
}

export async function fetchCollection<T>(
  companyId: string,
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const ref = companyCollection(companyId, collectionName)
  const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[]
}

export async function fetchDocument<T>(
  companyId: string,
  collectionName: string,
  docId: string
): Promise<T | null> {
  const ref = companyDoc(companyId, collectionName, docId)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() } as T
}

export async function createDocument(
  companyId: string,
  collectionName: string,
  data: DocumentData
): Promise<string> {
  const ref = companyCollection(companyId, collectionName)
  const now = Timestamp.now()
  const docRef = await addDoc(ref, { ...data, createdAt: now, updatedAt: now })
  return docRef.id
}

export async function updateDocument(
  companyId: string,
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  const ref = companyDoc(companyId, collectionName, docId)
  await updateDoc(ref, { ...data, updatedAt: Timestamp.now() })
}

export async function removeDocument(
  companyId: string,
  collectionName: string,
  docId: string
): Promise<void> {
  const ref = companyDoc(companyId, collectionName, docId)
  await deleteDoc(ref)
}
```

- [ ] **Step 4: Verify project compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/
git commit -m "feat: add Firebase config and typed Firestore CRUD helpers"
```

---

## Task 3: Company Context & Core Hooks

**Files:**
- Create: `src/core/ui/company-provider.tsx`, `src/core/hooks/use-company.ts`, `src/core/hooks/use-firestore.ts`

- [ ] **Step 1: Create CompanyProvider**

Create `src/core/ui/company-provider.tsx`:
```tsx
import { createContext, useState, useCallback, type ReactNode } from 'react'
import type { Company } from '@/core/types'

interface CompanyContextValue {
  companies: Company[]
  selectedCompany: Company | null
  selectCompany: (company: Company) => void
}

export const CompanyContext = createContext<CompanyContextValue | null>(null)

const DEFAULT_COMPANIES: Company[] = [
  { id: 'company-a', name: 'Compañía A', slug: 'company-a', createdAt: null as any },
  { id: 'company-b', name: 'Compañía B', slug: 'company-b', createdAt: null as any },
  { id: 'company-c', name: 'Compañía C', slug: 'company-c', createdAt: null as any },
  { id: 'company-d', name: 'Compañía D', slug: 'company-d', createdAt: null as any },
]

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies] = useState<Company[]>(DEFAULT_COMPANIES)
  const [selectedCompany, setSelectedCompany] = useState<Company>(DEFAULT_COMPANIES[0])

  const selectCompany = useCallback((company: Company) => {
    setSelectedCompany(company)
  }, [])

  return (
    <CompanyContext.Provider value={{ companies, selectedCompany, selectCompany }}>
      {children}
    </CompanyContext.Provider>
  )
}
```

- [ ] **Step 2: Create useCompany hook**

Create `src/core/hooks/use-company.ts`:
```ts
import { useContext } from 'react'
import { CompanyContext } from '@/core/ui/company-provider'

export function useCompany() {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider')
  }
  return context
}
```

- [ ] **Step 3: Create useFirestore generic hooks**

Create `src/core/hooks/use-firestore.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'
import { fetchCollection, fetchDocument } from '@/core/firebase/helpers'
import { useCompany } from './use-company'
import type { QueryConstraint } from 'firebase/firestore'

export function useCollection<T>(
  collectionName: string,
  ...constraints: QueryConstraint[]
) {
  const { selectedCompany } = useCompany()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchCollection<T>(selectedCompany.id, collectionName, ...constraints)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [selectedCompany?.id, collectionName])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

export function useDocument<T>(collectionName: string, docId: string | undefined) {
  const { selectedCompany } = useCompany()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!selectedCompany || !docId) return
    setLoading(true)
    setError(null)
    fetchDocument<T>(selectedCompany.id, collectionName, docId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err : new Error('Unknown error')))
      .finally(() => setLoading(false))
  }, [selectedCompany?.id, collectionName, docId])

  return { data, loading, error }
}
```

- [ ] **Step 4: Verify compilation**

Run:
```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/core/
git commit -m "feat: add CompanyProvider context and generic Firestore hooks"
```

---

## Task 4: Design System — Layout Components

**Files:**
- Create: `src/core/ui/layout.tsx`, `src/core/ui/topbar.tsx`, `src/core/ui/sidebar.tsx`, `src/core/ui/page-transition.tsx`, `src/core/animations/variants.ts`

- [ ] **Step 1: Create animation variants**

Create `src/core/animations/variants.ts`:
```ts
import type { Variants } from 'framer-motion'

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

export const staggerContainer: Variants = {
  animate: {
    transition: { staggerChildren: 0.05 },
  },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}

export const crossfade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
}
```

- [ ] **Step 2: Create Topbar**

Create `src/core/ui/topbar.tsx`:
```tsx
import { CircleUser } from 'lucide-react'
import { useCompany } from '@/core/hooks/use-company'
import { cn } from '@/lib/utils'

export function Topbar() {
  const { companies, selectedCompany, selectCompany } = useCompany()

  return (
    <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-border">
      <div className="text-[15px] font-bold text-dark-graphite tracking-tight">
        Business<span className="font-light text-mid-gray">Hub</span>
      </div>

      <div className="flex gap-1.5">
        {companies.map((company) => (
          <button
            key={company.id}
            onClick={() => selectCompany(company)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200',
              selectedCompany?.id === company.id
                ? 'bg-graphite text-white'
                : 'text-mid-gray hover:bg-smoke hover:text-graphite'
            )}
          >
            {company.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-mid-gray">
        <CircleUser size={16} strokeWidth={1.5} />
        <span>Admin</span>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create Sidebar**

Create `src/core/ui/sidebar.tsx`:
```tsx
import { NavLink } from 'react-router-dom'
import { BarChart3, Users, Briefcase, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/talent', label: 'Talento', icon: Users },
  { to: '/suppliers', label: 'Proveedores', icon: Briefcase },
  { to: '/finance', label: 'Finanzas', icon: DollarSign },
]

export function Sidebar() {
  return (
    <nav className="w-[210px] bg-white border-r border-border py-5 flex-shrink-0">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-5 py-2.5 text-[13px] transition-all duration-150',
              isActive
                ? 'text-dark-graphite font-medium bg-bone border-r-2 border-graphite'
                : 'text-mid-gray hover:bg-card-bg hover:text-graphite'
            )
          }
        >
          <Icon size={18} strokeWidth={1.5} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Create PageTransition wrapper**

Create `src/core/ui/page-transition.tsx`:
```tsx
import { motion } from 'framer-motion'
import { pageTransition } from '@/core/animations/variants'
import type { ReactNode } from 'react'

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 5: Create Layout**

Create `src/core/ui/layout.tsx`:
```tsx
import { Outlet } from 'react-router-dom'
import { Topbar } from './topbar'
import { Sidebar } from './sidebar'

export function Layout() {
  return (
    <div className="h-screen flex flex-col">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add src/core/ui/ src/core/animations/
git commit -m "feat: add layout shell — Topbar, Sidebar, PageTransition, animation variants"
```

---

## Task 5: Shared UI Components

**Files:**
- Create: `src/core/ui/kpi-card.tsx`, `src/core/ui/data-table.tsx`, `src/core/ui/status-badge.tsx`, `src/core/ui/page-header.tsx`, `src/core/ui/search-input.tsx`, `src/core/ui/empty-state.tsx`, `src/core/ui/confirm-dialog.tsx`

- [ ] **Step 1: Create KPICard with animated count-up**

Create `src/core/ui/kpi-card.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { staggerItem } from '@/core/animations/variants'
import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: number
  format?: 'number' | 'currency'
  change?: string
  trend?: 'up' | 'down'
  icon?: LucideIcon
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0)
  const prevTarget = useRef(target)

  useEffect(() => {
    prevTarget.current = target
    const start = performance.now()
    const from = 0

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(from + (target - from) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [target, duration])

  return count
}

export function KPICard({ label, value, format = 'number', change, trend, icon: Icon }: KPICardProps) {
  const animatedValue = useCountUp(value)

  const formattedValue = format === 'currency'
    ? `$${animatedValue.toLocaleString('en-US')}`
    : animatedValue.toLocaleString('en-US')

  return (
    <motion.div
      variants={staggerItem}
      className="bg-white rounded-xl p-[18px] border border-border"
    >
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-caption uppercase tracking-wider text-mid-gray">{label}</span>
        {Icon && <Icon size={16} strokeWidth={1.5} className="text-smoke" />}
      </div>
      <div className="text-kpi font-semibold text-dark-graphite">{formattedValue}</div>
      {change && (
        <div className={`flex items-center gap-1 mt-1 text-caption ${trend === 'down' ? 'text-negative-text' : 'text-positive-text'}`}>
          {trend === 'up' ? <ChevronUp size={12} strokeWidth={1.5} /> : <ChevronDown size={12} strokeWidth={1.5} />}
          {change}
        </div>
      )}
    </motion.div>
  )
}
```

- [ ] **Step 2: Create StatusBadge**

Create `src/core/ui/status-badge.tsx`:
```tsx
import { cn } from '@/lib/utils'

type BadgeVariant = 'active' | 'pending' | 'expired' | 'overdue' | 'inactive' | 'info' | 'paid'

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  active: 'bg-positive-bg text-positive-text',
  paid: 'bg-positive-bg text-positive-text',
  pending: 'bg-warning-bg text-warning-text',
  expired: 'bg-negative-bg text-negative-text',
  overdue: 'bg-negative-bg text-negative-text',
  inactive: 'bg-smoke text-mid-gray',
  info: 'bg-info-bg text-info-text',
}

const LABELS: Record<BadgeVariant, string> = {
  active: 'Activo',
  paid: 'Pagado',
  pending: 'Pendiente',
  expired: 'Vencido',
  overdue: 'Vencido',
  inactive: 'Inactivo',
  info: 'En revisión',
}

interface StatusBadgeProps {
  variant: BadgeVariant
  label?: string
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span className={cn('inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium', VARIANT_STYLES[variant])}>
      {label ?? LABELS[variant]}
    </span>
  )
}
```

- [ ] **Step 3: Create PageHeader**

Create `src/core/ui/page-header.tsx`:
```tsx
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  children?: ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-heading font-semibold text-dark-graphite">{title}</h1>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Create SearchInput**

Create `src/core/ui/search-input.tsx`:
```tsx
import { Search } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...' }: SearchInputProps) {
  return (
    <div className="relative">
      <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-mid-gray" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-input-border bg-card-bg text-body text-graphite placeholder:text-smoke focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
      />
    </div>
  )
}
```

- [ ] **Step 5: Create EmptyState**

Create `src/core/ui/empty-state.tsx`:
```tsx
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={40} strokeWidth={1} className="text-smoke mb-4" />
      <h3 className="text-subheading font-medium text-graphite mb-1">{title}</h3>
      <p className="text-body text-mid-gray">{description}</p>
    </div>
  )
}
```

- [ ] **Step 6: Create ConfirmDialog**

Create `src/core/ui/confirm-dialog.tsx`:
```tsx
import { motion, AnimatePresence } from 'framer-motion'
import { modalVariants } from '@/core/animations/variants'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, description, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20"
            onClick={onCancel}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-white rounded-xl p-6 shadow-lg max-w-sm w-full mx-4 border border-border"
          >
            <h3 className="text-subheading font-semibold text-dark-graphite mb-2">{title}</h3>
            <p className="text-body text-mid-gray mb-6">{description}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-[10px] text-[13px] font-medium border border-input-border text-graphite hover:bg-bone transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 rounded-[10px] text-[13px] font-medium bg-negative-text text-white hover:opacity-90 transition-all duration-200"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 7: Create DataTable**

Create `src/core/ui/data-table.tsx`:
```tsx
import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (item: T) => ReactNode
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (item: T) => void
}

export function DataTable<T extends { id: string }>({ columns, data, onRowClick }: DataTableProps<T>) {
  const gridCols = columns.map((c) => c.width ?? '1fr').join(' ')

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div
        className="grid px-[18px] py-3 text-caption uppercase tracking-wider text-mid-gray border-b border-border bg-card-bg"
        style={{ gridTemplateColumns: gridCols }}
      >
        {columns.map((col) => (
          <div key={col.key}>{col.header}</div>
        ))}
      </div>
      {data.map((item) => (
        <div
          key={item.id}
          onClick={() => onRowClick?.(item)}
          className="grid px-[18px] py-3.5 text-body text-graphite border-b border-bone last:border-b-0 hover:bg-card-bg transition-colors duration-150 cursor-pointer items-center"
          style={{ gridTemplateColumns: gridCols }}
        >
          {columns.map((col) => (
            <div key={col.key}>{col.render(item)}</div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 9: Commit**

```bash
git add src/core/ui/
git commit -m "feat: add shared UI components — KPICard, DataTable, StatusBadge, SearchInput, PageHeader, EmptyState, ConfirmDialog"
```

---

## Task 6: App Router & Module Shell

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`
- Create: `src/modules/insights/routes.tsx`, `src/modules/talent/routes.tsx`, `src/modules/suppliers/routes.tsx`, `src/modules/finance/routes.tsx`
- Create placeholder pages for each module

- [ ] **Step 1: Create placeholder pages for each module**

Create `src/modules/insights/components/kpi-dashboard.tsx`:
```tsx
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'

export function KPIDashboard() {
  return (
    <PageTransition>
      <PageHeader title="Panel de Insights" />
      <p className="text-mid-gray">Dashboard en construcción...</p>
    </PageTransition>
  )
}
```

Create `src/modules/talent/components/employee-list.tsx`:
```tsx
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'

export function EmployeeList() {
  return (
    <PageTransition>
      <PageHeader title="Directorio de Talento" />
      <p className="text-mid-gray">Módulo en construcción...</p>
    </PageTransition>
  )
}
```

Create `src/modules/suppliers/components/supplier-list.tsx`:
```tsx
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'

export function SupplierList() {
  return (
    <PageTransition>
      <PageHeader title="Central de Proveedores" />
      <p className="text-mid-gray">Módulo en construcción...</p>
    </PageTransition>
  )
}
```

Create `src/modules/finance/components/transaction-list.tsx`:
```tsx
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'

export function TransactionList() {
  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero" />
      <p className="text-mid-gray">Módulo en construcción...</p>
    </PageTransition>
  )
}
```

- [ ] **Step 2: Create route files for each module**

Create `src/modules/insights/routes.tsx`:
```tsx
import { lazy } from 'react'

const KPIDashboard = lazy(() => import('./components/kpi-dashboard').then(m => ({ default: m.KPIDashboard })))

export const insightsRoutes = [
  { index: true, element: <KPIDashboard /> },
]
```

Create `src/modules/talent/routes.tsx`:
```tsx
import { lazy } from 'react'

const EmployeeList = lazy(() => import('./components/employee-list').then(m => ({ default: m.EmployeeList })))

export const talentRoutes = [
  { index: true, element: <EmployeeList /> },
]
```

Create `src/modules/suppliers/routes.tsx`:
```tsx
import { lazy } from 'react'

const SupplierList = lazy(() => import('./components/supplier-list').then(m => ({ default: m.SupplierList })))

export const suppliersRoutes = [
  { index: true, element: <SupplierList /> },
]
```

Create `src/modules/finance/routes.tsx`:
```tsx
import { lazy } from 'react'

const TransactionList = lazy(() => import('./components/transaction-list').then(m => ({ default: m.TransactionList })))

export const financeRoutes = [
  { index: true, element: <TransactionList /> },
]
```

- [ ] **Step 3: Wire up App.tsx with router**

Replace `src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import { CompanyProvider } from '@/core/ui/company-provider'
import { Layout } from '@/core/ui/layout'
import { insightsRoutes } from '@/modules/insights/routes'
import { talentRoutes } from '@/modules/talent/routes'
import { suppliersRoutes } from '@/modules/suppliers/routes'
import { financeRoutes } from '@/modules/finance/routes'

function Loading() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="text-mid-gray text-body">Cargando...</div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <CompanyProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/insights" replace />} />
            <Route path="/insights" element={<Suspense fallback={<Loading />}>{insightsRoutes[0].element}</Suspense>} />
            <Route path="/talent" element={<Suspense fallback={<Loading />}>{talentRoutes[0].element}</Suspense>} />
            <Route path="/suppliers" element={<Suspense fallback={<Loading />}>{suppliersRoutes[0].element}</Suspense>} />
            <Route path="/finance" element={<Suspense fallback={<Loading />}>{financeRoutes[0].element}</Suspense>} />
          </Route>
        </Routes>
      </CompanyProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Update main.tsx**

Replace `src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 5: Run dev server and verify navigation**

Run: `npm run dev`

Expected: App loads with Topbar + Sidebar + content area. Clicking sidebar items navigates between modules. Company pills switch selection. All four placeholder pages render.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: add router, layout shell, and placeholder pages for all 4 modules"
```

---

## Task 7: Talent Module — Full Implementation

**Files:**
- Create: `src/modules/talent/types.ts`, `src/modules/talent/services.ts`, `src/modules/talent/hooks.ts`
- Create: `src/modules/talent/components/employee-form.tsx`, `src/modules/talent/components/employee-profile.tsx`
- Modify: `src/modules/talent/components/employee-list.tsx`, `src/modules/talent/routes.tsx`
- Modify: `src/App.tsx` (add talent sub-routes)

- [ ] **Step 1: Create Talent types**

Create `src/modules/talent/types.ts`:
```ts
import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity } from '@/core/types'

export interface Employee extends BaseEntity {
  name: string
  role: string
  department: string
  email: string
  phone: string
  salary: number
  startDate: Timestamp
  status: 'active' | 'inactive'
}

export type EmployeeFormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>
```

- [ ] **Step 2: Create Talent services**

Create `src/modules/talent/services.ts`:
```ts
import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Employee, EmployeeFormData } from './types'

const COLLECTION = 'employees'

export const talentService = {
  getAll: (companyId: string) => fetchCollection<Employee>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Employee>(companyId, COLLECTION, id),
  create: (companyId: string, data: EmployeeFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<EmployeeFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}
```

- [ ] **Step 3: Create Talent hooks**

Create `src/modules/talent/hooks.ts`:
```ts
import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import type { Employee } from './types'

export function useEmployees() {
  return useCollection<Employee>('employees')
}

export function useEmployee(id: string | undefined) {
  return useDocument<Employee>('employees', id)
}
```

- [ ] **Step 4: Build EmployeeList with search and filters**

Replace `src/modules/talent/components/employee-list.tsx`:
```tsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Users } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable, type Column } from '@/core/ui/data-table'
import { StatusBadge } from '@/core/ui/status-badge'
import { EmptyState } from '@/core/ui/empty-state'
import { staggerContainer } from '@/core/animations/variants'
import { useEmployees } from '../hooks'
import type { Employee } from '../types'

export function EmployeeList() {
  const { data: employees, loading } = useEmployees()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department))
    return Array.from(depts).sort()
  }, [employees])

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.role.toLowerCase().includes(search.toLowerCase())
      const matchesDept = filterDept === 'all' || e.department === filterDept
      const matchesStatus = filterStatus === 'all' || e.status === filterStatus
      return matchesSearch && matchesDept && matchesStatus
    })
  }, [employees, search, filterDept, filterStatus])

  const totalPayroll = useMemo(() => {
    return employees.filter((e) => e.status === 'active').reduce((sum, e) => sum + e.salary, 0)
  }, [employees])

  const columns: Column<Employee>[] = [
    { key: 'name', header: 'Nombre', render: (e) => <span className="font-medium">{e.name}</span>, width: '2fr' },
    { key: 'role', header: 'Cargo', render: (e) => e.role, width: '1.5fr' },
    { key: 'department', header: 'Departamento', render: (e) => e.department, width: '1fr' },
    { key: 'salary', header: 'Salario', render: (e) => `$${e.salary.toLocaleString()}`, width: '1fr' },
    { key: 'status', header: 'Estado', render: (e) => <StatusBadge variant={e.status} />, width: '0.8fr' },
  ]

  return (
    <PageTransition>
      <PageHeader title="Directorio de Talento">
        <button
          onClick={() => navigate('/talent/new')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-medium bg-graphite text-white hover:-translate-y-px hover:shadow-md transition-all duration-200"
        >
          <Plus size={16} strokeWidth={1.5} />
          Nuevo
        </button>
      </PageHeader>

      <div className="mb-4 text-caption text-mid-gray uppercase tracking-wider">
        Nómina total: <span className="text-graphite font-semibold">${totalPayroll.toLocaleString()}</span>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="w-72">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o cargo..." />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="px-3 py-2 rounded-[10px] border border-input-border bg-card-bg text-body text-graphite outline-none focus:border-input-focus transition-all"
        >
          <option value="all">Todos los departamentos</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-[10px] border border-input-border bg-card-bg text-body text-graphite outline-none focus:border-input-focus transition-all"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </div>

      {loading ? (
        <div className="text-mid-gray text-body py-10 text-center">Cargando...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Sin empleados" description="Agrega tu primer empleado para empezar" />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate">
          <DataTable columns={columns} data={filtered} onRowClick={(e) => navigate(`/talent/${e.id}`)} />
        </motion.div>
      )}
    </PageTransition>
  )
}
```

- [ ] **Step 5: Build EmployeeForm**

Create `src/modules/talent/components/employee-form.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { useCompany } from '@/core/hooks/use-company'
import { talentService } from '../services'
import { Timestamp } from 'firebase/firestore'

export function EmployeeForm() {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    role: '',
    department: '',
    email: '',
    phone: '',
    salary: 0,
    startDate: '',
    status: 'active' as const,
  })

  const update = (field: string, value: string | number) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCompany) return
    setSaving(true)
    try {
      await talentService.create(selectedCompany.id, {
        ...form,
        startDate: Timestamp.fromDate(new Date(form.startDate)),
      })
      navigate('/talent')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-card-bg text-body text-graphite placeholder:text-smoke focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'

  return (
    <PageTransition>
      <PageHeader title="Nuevo Empleado" />
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1.5">Nombre</label>
            <input className={inputClass} value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div>
            <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1.5">Cargo</label>
            <input className={inputClass} value={form.role} onChange={(e) => update('role', e.target.value)} required />
          </div>
          <div>
            <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1.5">Departamento</label>
            <input className={inputClass} value={form.department} onChange={(e) => update('department', e.target.value)} required />
          </div>
          <div>
            <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1.5">Email</label>
            <input type="email" className={inputClass} value={form.email} onChange={(e) => update('email', e.target.value)} required />
          </div>
          <div>
            <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1.5">Teléfono</label>
            <input className={inputClass} value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div>
            <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1.5">Salario</label>
            <input type="number" className={inputClass} value={form.salary} onChange={(e) => update('salary', Number(e.target.value))} required />
          </div>
          <div>
            <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1.5">Fecha de inicio</label>
            <input type="date" className={inputClass} value={form.startDate} onChange={(e) => update('startDate', e.target.value)} required />
          </div>
          <div>
            <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1.5">Estado</label>
            <select className={inputClass} value={form.status} onChange={(e) => update('status', e.target.value)}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-[10px] text-[13px] font-medium bg-graphite text-white hover:-translate-y-px hover:shadow-md transition-all duration-200 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/talent')}
            className="px-5 py-2.5 rounded-[10px] text-[13px] font-medium border border-input-border text-graphite hover:bg-bone transition-all duration-200"
          >
            Cancelar
          </button>
        </div>
      </form>
    </PageTransition>
  )
}
```

- [ ] **Step 6: Build EmployeeProfile with inline edit**

Create `src/modules/talent/components/employee-profile.tsx`:
```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Edit, Trash2, ArrowLeft } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { StatusBadge } from '@/core/ui/status-badge'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { useCompany } from '@/core/hooks/use-company'
import { useEmployee } from '../hooks'
import { talentService } from '../services'

export function EmployeeProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const { data: employee, loading } = useEmployee(id)
  const [editing, setEditing] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})

  const startEdit = () => {
    if (!employee) return
    setForm({
      name: employee.name,
      role: employee.role,
      department: employee.department,
      email: employee.email,
      phone: employee.phone,
      salary: employee.salary,
      status: employee.status,
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!selectedCompany || !id) return
    await talentService.update(selectedCompany.id, id, form)
    setEditing(false)
    window.location.reload()
  }

  const handleDelete = async () => {
    if (!selectedCompany || !id) return
    await talentService.remove(selectedCompany.id, id)
    navigate('/talent')
  }

  if (loading) return <div className="text-mid-gray py-10 text-center">Cargando...</div>
  if (!employee) return <div className="text-mid-gray py-10 text-center">Empleado no encontrado</div>

  const inputClass = 'w-full px-3 py-2 rounded-[10px] border border-input-border bg-card-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all'
  const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

  const formatDate = (ts: Timestamp) => ts?.toDate?.().toLocaleDateString('es-ES') ?? '—'

  return (
    <PageTransition>
      <div className="mb-4">
        <button onClick={() => navigate('/talent')} className="flex items-center gap-1.5 text-mid-gray hover:text-graphite text-body transition-colors">
          <ArrowLeft size={16} strokeWidth={1.5} /> Volver
        </button>
      </div>

      <PageHeader title={editing ? 'Editar Empleado' : employee.name}>
        {!editing && (
          <>
            <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-medium border border-input-border text-graphite hover:bg-bone transition-all">
              <Edit size={14} strokeWidth={1.5} /> Editar
            </button>
            <button onClick={() => setShowDelete(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-medium border border-input-border text-negative-text hover:bg-negative-bg transition-all">
              <Trash2 size={14} strokeWidth={1.5} /> Eliminar
            </button>
          </>
        )}
      </PageHeader>

      <div className="max-w-2xl bg-white rounded-xl border border-border p-6">
        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Nombre</label><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className={labelClass}>Cargo</label><input className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
            <div><label className={labelClass}>Departamento</label><input className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div><label className={labelClass}>Email</label><input className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className={labelClass}>Teléfono</label><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className={labelClass}>Salario</label><input type="number" className={inputClass} value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} /></div>
            <div><label className={labelClass}>Estado</label>
              <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-2 pt-2">
              <button onClick={saveEdit} className="px-5 py-2 rounded-[10px] text-[13px] font-medium bg-graphite text-white hover:-translate-y-px hover:shadow-md transition-all">Guardar</button>
              <button onClick={() => setEditing(false)} className="px-5 py-2 rounded-[10px] text-[13px] font-medium border border-input-border text-graphite hover:bg-bone transition-all">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-y-5">
            <div><span className={labelClass}>Cargo</span><span className="text-body">{employee.role}</span></div>
            <div><span className={labelClass}>Departamento</span><span className="text-body">{employee.department}</span></div>
            <div><span className={labelClass}>Email</span><span className="text-body">{employee.email}</span></div>
            <div><span className={labelClass}>Teléfono</span><span className="text-body">{employee.phone}</span></div>
            <div><span className={labelClass}>Salario</span><span className="text-body font-medium">${employee.salary.toLocaleString()}</span></div>
            <div><span className={labelClass}>Fecha de inicio</span><span className="text-body">{formatDate(employee.startDate)}</span></div>
            <div><span className={labelClass}>Estado</span><StatusBadge variant={employee.status} /></div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Eliminar empleado"
        description={`¿Estás seguro de que quieres eliminar a ${employee.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </PageTransition>
  )
}
```

- [ ] **Step 7: Update talent routes and App.tsx**

Update `src/modules/talent/routes.tsx`:
```tsx
import { lazy } from 'react'

const EmployeeList = lazy(() => import('./components/employee-list').then(m => ({ default: m.EmployeeList })))
const EmployeeForm = lazy(() => import('./components/employee-form').then(m => ({ default: m.EmployeeForm })))
const EmployeeProfile = lazy(() => import('./components/employee-profile').then(m => ({ default: m.EmployeeProfile })))

export const talentRoutes = { EmployeeList, EmployeeForm, EmployeeProfile }
```

Update `src/App.tsx` to add talent sub-routes:
```tsx
// Inside the Routes, replace the single /talent route with:
<Route path="/talent" element={<Suspense fallback={<Loading />}><talentRoutes.EmployeeList /></Suspense>} />
<Route path="/talent/new" element={<Suspense fallback={<Loading />}><talentRoutes.EmployeeForm /></Suspense>} />
<Route path="/talent/:id" element={<Suspense fallback={<Loading />}><talentRoutes.EmployeeProfile /></Suspense>} />
```

Import the updated routes object at the top of App.tsx:
```tsx
import { talentRoutes } from '@/modules/talent/routes'
```

- [ ] **Step 8: Verify compilation and test navigation**

Run: `npm run dev`
Verify: Navigate to /talent, /talent/new — pages render correctly.

- [ ] **Step 9: Commit**

```bash
git add src/modules/talent/
git commit -m "feat: implement Talent module — employee list, create form, profile with inline edit"
```

---

## Task 8: Suppliers Module — Full Implementation

**Files:**
- Create: `src/modules/suppliers/types.ts`, `src/modules/suppliers/services.ts`, `src/modules/suppliers/hooks.ts`
- Create: `src/modules/suppliers/components/supplier-form.tsx`, `src/modules/suppliers/components/supplier-detail.tsx`
- Modify: `src/modules/suppliers/components/supplier-list.tsx`, `src/modules/suppliers/routes.tsx`
- Modify: `src/App.tsx`

This module mirrors Talent in structure. Key differences: contract date tracking, expiration alerts, and supplier-specific fields.

- [ ] **Step 1: Create Supplier types**

Create `src/modules/suppliers/types.ts`:
```ts
import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity, SupplierStatus } from '@/core/types'

export interface Supplier extends BaseEntity {
  name: string
  category: string
  contactName: string
  email: string
  phone: string
  contractStart: Timestamp
  contractEnd: Timestamp
  status: SupplierStatus
}

export type SupplierFormData = Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>
```

- [ ] **Step 2: Create Supplier services**

Create `src/modules/suppliers/services.ts`:
```ts
import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Supplier, SupplierFormData } from './types'

const COLLECTION = 'suppliers'

export const supplierService = {
  getAll: (companyId: string) => fetchCollection<Supplier>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Supplier>(companyId, COLLECTION, id),
  create: (companyId: string, data: SupplierFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<SupplierFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),
}
```

- [ ] **Step 3: Create Supplier hooks**

Create `src/modules/suppliers/hooks.ts`:
```ts
import { useCollection, useDocument } from '@/core/hooks/use-firestore'
import type { Supplier } from './types'

export function useSuppliers() {
  return useCollection<Supplier>('suppliers')
}

export function useSupplier(id: string | undefined) {
  return useDocument<Supplier>('suppliers', id)
}
```

- [ ] **Step 4: Build SupplierList with contract expiration alerts**

Replace `src/modules/suppliers/components/supplier-list.tsx` — follows EmployeeList pattern but adds contract expiration logic:
- Show an alert badge on suppliers with `contractEnd` within 30 days
- Filter by category and status
- Display contract end date in the table

- [ ] **Step 5: Build SupplierForm**

Create `src/modules/suppliers/components/supplier-form.tsx` — follows EmployeeForm pattern with fields: name, category, contactName, email, phone, contractStart, contractEnd, status.

- [ ] **Step 6: Build SupplierDetail with inline edit**

Create `src/modules/suppliers/components/supplier-detail.tsx` — follows EmployeeProfile pattern with supplier-specific fields and contract date display.

- [ ] **Step 7: Update suppliers routes and App.tsx**

Update routes to export `{ SupplierList, SupplierForm, SupplierDetail }`. Add `/suppliers`, `/suppliers/new`, `/suppliers/:id` routes to App.tsx.

- [ ] **Step 8: Verify and commit**

```bash
git add src/modules/suppliers/
git commit -m "feat: implement Suppliers module — list with contract alerts, create form, detail with inline edit"
```

---

## Task 9: Finance Module — Full Implementation

**Files:**
- Create: `src/modules/finance/types.ts`, `src/modules/finance/services.ts`, `src/modules/finance/hooks.ts`
- Create: `src/modules/finance/components/transaction-form.tsx`, `src/modules/finance/components/finance-summary.tsx`, `src/modules/finance/components/import-view.tsx`
- Modify: `src/modules/finance/components/transaction-list.tsx`, `src/modules/finance/routes.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create Finance types**

Create `src/modules/finance/types.ts`:
```ts
import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity, TransactionType, TransactionStatus } from '@/core/types'

export interface Transaction extends BaseEntity {
  concept: string
  category: string
  amount: number
  type: TransactionType
  date: Timestamp
  status: TransactionStatus
  notes?: string
}

export type TransactionFormData = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
```

- [ ] **Step 2: Create Finance services**

Create `src/modules/finance/services.ts` — same CRUD pattern as talent/suppliers for `transactions` collection.

- [ ] **Step 3: Create Finance hooks**

Create `src/modules/finance/hooks.ts`:
```ts
import { useMemo } from 'react'
import { useCollection } from '@/core/hooks/use-firestore'
import type { Transaction } from './types'

export function useTransactions() {
  return useCollection<Transaction>('transactions')
}

export function useFinanceSummary() {
  const { data: transactions, loading } = useTransactions()

  const summary = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income, expenses, balance: income - expenses }
  }, [transactions])

  return { summary, loading }
}
```

- [ ] **Step 4: Build FinanceSummary cards**

Create `src/modules/finance/components/finance-summary.tsx` — three KPICard components showing total income (positive), total expenses (negative), and balance.

- [ ] **Step 5: Build TransactionList with filters**

Replace `src/modules/finance/components/transaction-list.tsx`:
- FinanceSummary cards at the top
- Filters: category, type (income/expense), status, date range (two date inputs)
- DataTable with columns: concept, category, amount (colored by type), date, status badge
- "+ Nueva" button to /finance/new, "Importar" button to /finance/import

- [ ] **Step 6: Build TransactionForm**

Create `src/modules/finance/components/transaction-form.tsx` — form with fields: concept, category, amount, type (select: income/expense), date, status, notes (optional textarea).

- [ ] **Step 7: Build ImportView with CSV/Excel validation**

Create `src/modules/finance/components/import-view.tsx`:
```tsx
// Key logic:
// 1. File input accepts .csv, .xlsx, .xls
// 2. Parse with PapaParse (CSV) or xlsx (Excel)
// 3. Validate required columns: concept, amount, type, date
// 4. Show preview table of parsed rows
// 5. Show row-level errors (missing fields, invalid amounts)
// 6. "Importar N registros" button to batch-create valid rows
// 7. Show summary after import: X imported, Y errors
```

Uses `papaparse` for CSV and `xlsx` for Excel files. Validates each row has required columns. Shows error feedback per row.

- [ ] **Step 8: Update finance routes and App.tsx**

Add routes: `/finance`, `/finance/new`, `/finance/import`, `/finance/:id`

- [ ] **Step 9: Verify and commit**

```bash
git add src/modules/finance/
git commit -m "feat: implement Finance module — transactions, summary, CSV/Excel import with validation"
```

---

## Task 10: Insights Module — Dashboard with Charts

**Files:**
- Create: `src/modules/insights/types.ts`, `src/modules/insights/services.ts`, `src/modules/insights/hooks.ts`
- Create: `src/modules/insights/components/trend-chart.tsx`, `src/modules/insights/components/category-breakdown.tsx`, `src/modules/insights/components/export-pdf.tsx`
- Modify: `src/modules/insights/components/kpi-dashboard.tsx`

- [ ] **Step 1: Create Insights types**

Create `src/modules/insights/types.ts`:
```ts
export interface KPIData {
  totalEmployees: number
  totalSuppliers: number
  totalIncome: number
  totalExpenses: number
  balance: number
  employeeChange: string
  supplierChange: string
  expenseChange: string
  balanceChange: string
}

export interface TrendPoint {
  month: string
  income: number
  expenses: number
}

export interface CategoryData {
  category: string
  amount: number
}
```

- [ ] **Step 2: Create Insights hooks**

Create `src/modules/insights/hooks.ts` — `useKPIs()` fetches employees, suppliers, and transactions for the selected company, computes KPI totals client-side. `useTrends()` groups transactions by month. `useCategoryBreakdown()` groups expenses by category.

- [ ] **Step 3: Build TrendChart**

Create `src/modules/insights/components/trend-chart.tsx`:
```tsx
// Recharts LineChart with:
// - X axis: months
// - Two lines: income (positive-text color) and expenses (negative-text color)
// - Styled with the design system colors
// - Tooltip with custom styling matching the design system
// - Responsive container
```

- [ ] **Step 4: Build CategoryBreakdown**

Create `src/modules/insights/components/category-breakdown.tsx`:
```tsx
// Recharts horizontal BarChart:
// - Y axis: category names
// - X axis: amounts
// - Bars in graphite color
// - Custom tooltip
```

- [ ] **Step 5: Build ExportPDF**

Create `src/modules/insights/components/export-pdf.tsx`:
```tsx
// Uses html2canvas + jsPDF:
// 1. Capture the dashboard content as canvas
// 2. Convert to PDF
// 3. Download as "BusinessHub-Insights-{company}-{date}.pdf"
```

- [ ] **Step 6: Build full KPIDashboard**

Replace `src/modules/insights/components/kpi-dashboard.tsx`:
```tsx
// Layout:
// 1. PageHeader with "Panel de Insights" + ExportPDF button
// 2. 4 KPICards in a grid: employees, suppliers, gastos del mes, balance
// 3. TrendChart (line chart of monthly income vs expenses)
// 4. CategoryBreakdown (horizontal bar chart)
// All wrapped in stagger container animations
```

- [ ] **Step 7: Verify and commit**

```bash
git add src/modules/insights/
git commit -m "feat: implement Insights module — KPI dashboard, trend charts, category breakdown, PDF export"
```

---

## Task 11: Final Integration & Polish

**Files:**
- Modify: `src/App.tsx` (ensure all routes are wired)
- Verify: all modules work together with company switching

- [ ] **Step 1: Verify all routes are registered in App.tsx**

Ensure all routes from all modules are present:
- `/insights`
- `/talent`, `/talent/new`, `/talent/:id`
- `/suppliers`, `/suppliers/new`, `/suppliers/:id`
- `/finance`, `/finance/new`, `/finance/import`

- [ ] **Step 2: Test company switching**

Verify: changing company via Topbar pills reloads data in every module (useCompany hook triggers re-fetch via useEffect).

- [ ] **Step 3: Verify animations work**

Check:
- Page transitions (fadeIn + slideUp) when navigating between modules
- Staggered list entrance when data loads
- KPI count-up animation on Insights page
- Modal animation on delete confirmation
- Hover effects on cards, buttons, and table rows

- [ ] **Step 4: Build verification**

Run:
```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete BusinessHub — all modules integrated with company switching and animations"
```
