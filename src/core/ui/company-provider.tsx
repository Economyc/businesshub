import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  setDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import type { Company } from '@/core/types'
import type { CategoryItem } from '@/core/types/categories'
import { slugify, DEFAULT_CATEGORIES, migrateOldCategories } from '@/core/utils/categories'
import { imageUrlToBase64 } from '@/core/utils/image'
import { cacheGet, cacheSet } from '@/core/utils/cache'
import { preloadLogos } from '@/core/utils/logo-cache'

interface CompanyContextValue {
  companies: Company[]
  selectedCompany: Company | null
  categories: CategoryItem[]
  roles: string[]
  departments: string[]
  loading: boolean
  selectCompany: (company: Company) => void
  updateCompany: (id: string, updates: Partial<Pick<Company, 'name' | 'location' | 'color' | 'logo' | 'logoThumb'>>) => void
  deleteCompany: (id: string) => void
  addCompany: () => Promise<string>
  addCategory: (name: string, color?: string) => void
  removeCategory: (id: string) => void
  updateCategory: (id: string, updates: Partial<Pick<CategoryItem, 'name' | 'color'>>) => void
  addSubcategory: (categoryId: string, subcategory: string) => void
  removeSubcategory: (categoryId: string, subcategory: string) => void
  updateSubcategory: (categoryId: string, oldName: string, newName: string) => void
  addRole: (name: string) => void
  removeRole: (name: string) => void
  updateRole: (oldName: string, newName: string) => void
  addDepartment: (name: string) => void
  removeDepartment: (name: string) => void
  updateDepartment: (oldName: string, newName: string) => void
}

export const CompanyContext = createContext<CompanyContextValue | null>(null)

const companiesRef = collection(db, 'companies')
const categoriesDocRef = doc(db, 'settings', 'categories')
const rolesDocRef = doc(db, 'settings', 'roles')
const departmentsDocRef = doc(db, 'settings', 'departments')

function persistCategories(cats: CategoryItem[]) {
  setDoc(categoriesDocRef, { categories: cats })
  cacheSet('categories', cats)
}

function persistRoles(list: string[]) {
  setDoc(rolesDocRef, { list })
  cacheSet('roles', list)
}

function persistDepartments(list: string[]) {
  setDoc(departmentsDocRef, { list })
  cacheSet('departments', list)
}

// Load cached data immediately
const cachedCompanies = cacheGet<Company[]>('companies')
const cachedCategories = cacheGet<CategoryItem[]>('categories')
const cachedRoles = cacheGet<string[]>('roles')
const cachedDepartments = cacheGet<string[]>('departments')
const cachedSelectedId = cacheGet<string>('selectedCompanyId')

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>(cachedCompanies ?? [])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(() => {
    if (!cachedCompanies?.length) return null
    return cachedCompanies.find((c) => c.id === cachedSelectedId) ?? cachedCompanies[0]
  })
  const [categories, setCategories] = useState<CategoryItem[]>(cachedCategories ?? [])
  const [roles, setRoles] = useState<string[]>(cachedRoles ?? [])
  const [departments, setDepartments] = useState<string[]>(cachedDepartments ?? [])
  const [loading, setLoading] = useState(!cachedCompanies)

  // --- Fetch fresh data from Firestore in background ---
  useEffect(() => {
    async function load() {
      try {
        // Fetch companies
        const snapshot = await getDocs(companiesRef)
        let loaded: Company[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Company[]

        // If no companies exist yet, seed defaults
        if (loaded.length === 0) {
          const defaults = [
            { name: 'Compañía A', slug: 'company-a' },
            { name: 'Compañía B', slug: 'company-b' },
            { name: 'Compañía C', slug: 'company-c' },
            { name: 'Compañía D', slug: 'company-d' },
          ]
          const now = Timestamp.now()
          for (const d of defaults) {
            const ref = await addDoc(companiesRef, { ...d, createdAt: now })
            loaded.push({ id: ref.id, ...d, createdAt: now } as Company)
          }
        }

        // Regenerate logo thumbnails (aspect-ratio preserving)
        const thumbVersion = cacheGet<number>('thumbVer') ?? 0
        for (const c of loaded) {
          if (c.logo && (!c.logoThumb || thumbVersion < 3)) {
            imageUrlToBase64(c.logo)
              .then((thumb) => {
                updateDoc(doc(db, 'companies', c.id), { logoThumb: thumb })
                c.logoThumb = thumb
                setCompanies((prev) => {
                  const updated = prev.map((p) => p.id === c.id ? { ...p, logoThumb: thumb } : p)
                  cacheSet('companies', updated)
                  return updated
                })
                setSelectedCompany((prev) => prev?.id === c.id ? { ...prev, logoThumb: thumb } : prev)
              })
              .catch(() => {})
          }
        }
        cacheSet('thumbVer', 3)

        cacheSet('companies', loaded)
        setCompanies(loaded)
        setSelectedCompany((prev) => {
          if (prev) {
            // Update selected company with fresh data
            const fresh = loaded.find((c) => c.id === prev.id)
            return fresh ?? loaded[0] ?? null
          }
          return loaded[0] ?? null
        })

        // Preload logo thumbnails in background (for instant picker)
        preloadLogos()

        // Fetch categories
        const catSnap = await getDoc(categoriesDocRef)
        if (catSnap.exists()) {
          const data = catSnap.data()
          if (data.list && !data.categories) {
            const migrated = migrateOldCategories(data.list)
            await setDoc(categoriesDocRef, { categories: migrated })
            cacheSet('categories', migrated)
            setCategories(migrated)
          } else {
            const cats = data.categories ?? []
            cacheSet('categories', cats)
            setCategories(cats)
          }
        } else {
          await setDoc(categoriesDocRef, { categories: DEFAULT_CATEGORIES })
          cacheSet('categories', [...DEFAULT_CATEGORIES])
          setCategories([...DEFAULT_CATEGORIES])
        }

        // Fetch roles
        const rolesSnap = await getDoc(rolesDocRef)
        if (rolesSnap.exists()) {
          const r = rolesSnap.data().list ?? []
          cacheSet('roles', r)
          setRoles(r)
        }

        // Fetch departments
        const depsSnap = await getDoc(departmentsDocRef)
        if (depsSnap.exists()) {
          const d = depsSnap.data().list ?? []
          cacheSet('departments', d)
          setDepartments(d)
        }
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const selectCompany = useCallback((company: Company) => {
    setSelectedCompany(company)
    cacheSet('selectedCompanyId', company.id)
  }, [])

  const updateCompany = useCallback(async (id: string, updates: Partial<Pick<Company, 'name' | 'location' | 'color' | 'logo' | 'logoThumb'>>) => {
    const companyRef = doc(db, 'companies', id)
    const data: Record<string, unknown> = { updatedAt: Timestamp.now() }
    for (const [key, val] of Object.entries(updates)) {
      data[key] = val === undefined || val === '' ? deleteField() : val
    }
    await updateDoc(companyRef, data)
    setCompanies((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c
        const u = { ...c }
        for (const [key, val] of Object.entries(updates)) {
          if (val === undefined || val === '') {
            delete (u as Record<string, unknown>)[key]
          } else {
            ;(u as Record<string, unknown>)[key] = val
          }
        }
        return u
      })
      cacheSet('companies', updated)
      return updated
    })
    setSelectedCompany((prev) => {
      if (!prev || prev.id !== id) return prev
      const updated = { ...prev }
      for (const [key, val] of Object.entries(updates)) {
        if (val === undefined || val === '') {
          delete (updated as Record<string, unknown>)[key]
        } else {
          ;(updated as Record<string, unknown>)[key] = val
        }
      }
      return updated
    })
  }, [])

  const deleteCompany = useCallback(async (id: string) => {
    const ref = doc(db, 'companies', id)
    await deleteDoc(ref)
    setCompanies((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      cacheSet('companies', updated)
      setSelectedCompany((sel) => (sel?.id === id ? updated[0] ?? null : sel))
      return updated
    })
  }, [])

  const addCompany = useCallback(async () => {
    const now = Timestamp.now()
    const data = { name: 'Nueva Compañía', slug: `company-${Date.now()}`, createdAt: now }
    const ref = await addDoc(companiesRef, data)
    const newCompany: Company = { id: ref.id, ...data } as Company
    setCompanies((prev) => {
      const updated = [...prev, newCompany]
      cacheSet('companies', updated)
      return updated
    })
    return ref.id
  }, [])

  const addCategory = useCallback((name: string, color?: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setCategories((prev) => {
      if (prev.some((c) => c.name === trimmed)) return prev
      const newCat: CategoryItem = {
        id: slugify(trimmed),
        name: trimmed,
        color: color ?? '#95A5A6',
        subcategories: [],
      }
      const updated = [...prev, newCat]
      persistCategories(updated)
      return updated
    })
  }, [])

  const removeCategory = useCallback((id: string) => {
    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      persistCategories(updated)
      return updated
    })
  }, [])

  const updateCategory = useCallback((id: string, updates: Partial<Pick<CategoryItem, 'name' | 'color'>>) => {
    setCategories((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c
        return { ...c, ...updates }
      })
      persistCategories(updated)
      return updated
    })
  }, [])

  const addSubcategory = useCallback((categoryId: string, subcategory: string) => {
    const trimmed = subcategory.trim()
    if (!trimmed) return
    setCategories((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== categoryId) return c
        if (c.subcategories.includes(trimmed)) return c
        return { ...c, subcategories: [...c.subcategories, trimmed] }
      })
      persistCategories(updated)
      return updated
    })
  }, [])

  const removeSubcategory = useCallback((categoryId: string, subcategory: string) => {
    setCategories((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== categoryId) return c
        return { ...c, subcategories: c.subcategories.filter((s) => s !== subcategory) }
      })
      persistCategories(updated)
      return updated
    })
  }, [])

  const updateSubcategory = useCallback((categoryId: string, oldName: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    setCategories((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== categoryId) return c
        if (c.subcategories.includes(trimmed)) return c
        return { ...c, subcategories: c.subcategories.map((s) => s === oldName ? trimmed : s) }
      })
      persistCategories(updated)
      return updated
    })
  }, [])

  const addRole = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setRoles((prev) => {
      if (prev.includes(trimmed)) return prev
      const updated = [...prev, trimmed]
      persistRoles(updated)
      return updated
    })
  }, [])

  const removeRole = useCallback((name: string) => {
    setRoles((prev) => {
      const updated = prev.filter((r) => r !== name)
      persistRoles(updated)
      return updated
    })
  }, [])

  const updateRole = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    setRoles((prev) => {
      if (prev.includes(trimmed)) return prev
      const updated = prev.map((r) => r === oldName ? trimmed : r)
      persistRoles(updated)
      return updated
    })
  }, [])

  const addDepartment = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setDepartments((prev) => {
      if (prev.includes(trimmed)) return prev
      const updated = [...prev, trimmed]
      persistDepartments(updated)
      return updated
    })
  }, [])

  const removeDepartment = useCallback((name: string) => {
    setDepartments((prev) => {
      const updated = prev.filter((d) => d !== name)
      persistDepartments(updated)
      return updated
    })
  }, [])

  const updateDepartment = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    setDepartments((prev) => {
      if (prev.includes(trimmed)) return prev
      const updated = prev.map((d) => d === oldName ? trimmed : d)
      persistDepartments(updated)
      return updated
    })
  }, [])

  return (
    <CompanyContext.Provider value={{
      companies, selectedCompany, categories, roles, departments, loading,
      selectCompany, updateCompany, deleteCompany, addCompany,
      addCategory, removeCategory, updateCategory,
      addSubcategory, removeSubcategory, updateSubcategory,
      addRole, removeRole, updateRole,
      addDepartment, removeDepartment, updateDepartment,
    }}>
      {children}
    </CompanyContext.Provider>
  )
}
