import { createContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
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
import { fileToBase64Thumb } from '@/core/utils/image'
import { cacheGet, cacheSet } from '@/core/utils/cache'
import { prefetchHomeData, resetPrefetchCache } from '@/core/utils/prefetch'
import { queryClient } from '@/core/query/query-client'
import { useAuth } from '@/core/hooks/use-auth'
import { OWNER_EMAIL } from '@/core/config/access-registry'

/**
 * Por company, qué sabemos del acceso del usuario actual:
 * - `isMember`: existe un doc en `companies/{id}/members/{uid}`.
 * - `allowedCompanyIds`: del rol asignado al miembro (si está restringido).
 *
 * Una company es visible si `isMember` y, en caso de tener `allowedCompanyIds`,
 * el id de la company está incluido. El owner ignora todo este filtro.
 */
interface CompanyAccessEntry {
  isMember: boolean
  allowedCompanyIds?: string[]
}
type CompanyAccessMap = Record<string, CompanyAccessEntry>

// Split en dos contextos para evitar re-renders globales:
//  - CompanyContext: companies + selectedCompany. Lo consumen 49 archivos.
//  - SettingsContext: categories + departments. Lo consumen ~9 archivos
//    (settings UIs, employee-form, transaction-list, analytics).
// Antes era un unico contexto: editar un departamento gatillaba re-render en
// los 58 consumers. Ahora cada Provider memoiza su value con sus propias deps,
// asi cambios en settings solo re-renderizan a quien usa SettingsContext.
interface CompanyContextValue {
  /** Companies visibles para el usuario (filtradas por membership + allowedCompanyIds del rol). */
  companies: Company[]
  /** Lista raw, sin filtro. Solo para flujos del owner (ej. selector de empresas permitidas en Cargos). */
  allCompanies: Company[]
  selectedCompany: Company | null
  loading: boolean
  selectCompany: (company: Company) => void
  updateCompany: (id: string, updates: Partial<Pick<Company, 'name' | 'location' | 'color' | 'logo' | 'logoThumb' | 'driveRootFolderId' | 'driveDiscountsFolderId'>>) => void
  deleteCompany: (id: string) => void
  addCompany: () => Promise<string>
}

interface SettingsContextValue {
  categories: CategoryItem[]
  departments: string[]
  addCategory: (name: string, color?: string) => void
  removeCategory: (id: string) => void
  updateCategory: (id: string, updates: Partial<Pick<CategoryItem, 'name' | 'color'>>) => void
  addSubcategory: (categoryId: string, subcategory: string) => void
  removeSubcategory: (categoryId: string, subcategory: string) => void
  updateSubcategory: (categoryId: string, oldName: string, newName: string) => void
  addDepartment: (name: string) => void
  removeDepartment: (name: string) => void
  updateDepartment: (oldName: string, newName: string) => void
}

export const CompanyContext = createContext<CompanyContextValue | null>(null)
export const SettingsContext = createContext<SettingsContextValue | null>(null)

const companiesRef = collection(db, 'companies')
const categoriesDocRef = doc(db, 'settings', 'categories')
const departmentsDocRef = doc(db, 'settings', 'departments')

function persistCategories(cats: CategoryItem[]) {
  setDoc(categoriesDocRef, { categories: cats })
  cacheSet('categories', cats)
}

function persistDepartments(list: string[]) {
  setDoc(departmentsDocRef, { list })
  cacheSet('departments', list)
}

// Load cached data immediately
const cachedCompanies = cacheGet<Company[]>('companies')
const cachedCategories = cacheGet<CategoryItem[]>('categories')
const cachedDepartments = cacheGet<string[]>('departments')
const cachedSelectedId = cacheGet<string>('selectedCompanyId')

// v2: la semántica del filtro cambió (rol restrictivo manda globalmente,
// no per-company). Subir la versión invalida cachés viejas en el browser de
// cada usuario y fuerza una lectura fresca de memberships/roles.
const accessCacheKey = (uid: string) => `companyAccess:v2:${uid}`

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const cachedAccess = user ? cacheGet<CompanyAccessMap>(accessCacheKey(user.uid)) : null

  const [allCompanies, setAllCompanies] = useState<Company[]>(cachedCompanies ?? [])
  const [companyAccess, setCompanyAccess] = useState<CompanyAccessMap>(cachedAccess ?? {})
  const [accessLoaded, setAccessLoaded] = useState<boolean>(Boolean(cachedAccess))
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(() => {
    if (!cachedCompanies?.length) return null
    return cachedCompanies.find((c) => c.id === cachedSelectedId) ?? cachedCompanies[0]
  })
  const [categories, setCategories] = useState<CategoryItem[]>(cachedCategories ?? [])
  const [departments, setDepartments] = useState<string[]>(cachedDepartments ?? [])
  const [loading, setLoading] = useState(!cachedCompanies)

  const isOwnerByEmail = (user?.email ?? '').toLowerCase() === OWNER_EMAIL

  // companies visible = allCompanies filtradas. Owner bypassea todo el filtro.
  // Mientras `accessLoaded` sea false y no haya cache, dejamos la lista vacía
  // para evitar flash de companies que después desaparecen.
  //
  // Regla GLOBAL (no per-membership):
  //  1. Si el usuario tiene CUALQUIER rol con `allowedCompanyIds` definido
  //     (incluso `[]`), está "restringido". Su universo total visible es la
  //     UNIÓN de todos esos arrays, sin importar otros memberships sueltos
  //     que tenga sin restricción. Esto resuelve el caso de memberships
  //     viejos creados por el seed automático antiguo: aunque el usuario
  //     siga como member de Filipo con rol 'viewer' (sin allowedCompanyIds),
  //     si tiene "Blue Staff" en Blue Manila con [manila, oculta], solo verá
  //     {manila, oculta}. El rol restrictivo manda.
  //  2. Si ningún rol restringe, el usuario ve todas las companies donde es
  //     miembro (comportamiento previo, compatible con roles existentes).
  //  3. La membership sigue siendo requisito final: estar en la unión sin
  //     ser member no basta — el usuario tampoco puede leer datos de esa
  //     company por reglas. Ergo: visible = (en unión, si hay restricción)
  //     AND (es member de la company).
  const companies = useMemo<Company[]>(() => {
    if (isOwnerByEmail) return allCompanies
    if (!accessLoaded) return []

    const restrictedEntries = Object.values(companyAccess).filter(
      (e) => e.isMember && Array.isArray(e.allowedCompanyIds),
    )
    const isRestricted = restrictedEntries.length > 0
    const allowedUnion = isRestricted
      ? new Set(restrictedEntries.flatMap((e) => e.allowedCompanyIds ?? []))
      : null

    return allCompanies.filter((c) => {
      const access = companyAccess[c.id]
      if (!access || !access.isMember) return false
      if (allowedUnion && !allowedUnion.has(c.id)) return false
      return true
    })
  }, [allCompanies, companyAccess, accessLoaded, isOwnerByEmail])

  // --- Fetch fresh data from Firestore in background ---
  // Las 4 lecturas (companies, categories, roles, departments) van en paralelo
  // — antes iban en serie, sumaban 4 RTTs antes de poder mostrar nada. Los
  // thumbnails de logos se generan fire-and-forget al final, ya no bloquean
  // la carga del selector de empresas.
  // Gate por `user`: sin sesión autenticada las reglas de Firestore rechazan
  // los reads y vemos "Missing or insufficient permissions" en incógnito.
  // El redirect a /login lo maneja ProtectedShellless/ProtectedRoute.
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    async function load() {
      try {
        const [companiesSnap, catSnap, depsSnap] = await Promise.all([
          getDocs(companiesRef),
          getDoc(categoriesDocRef),
          getDoc(departmentsDocRef),
        ])

        // ─── Companies ───
        let loaded: Company[] = companiesSnap.docs.map((d) => ({
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

        cacheSet('companies', loaded)
        setAllCompanies(loaded)
        setSelectedCompany((prev) => {
          if (prev) {
            const fresh = loaded.find((c) => c.id === prev.id)
            return fresh ?? loaded[0] ?? null
          }
          return loaded[0] ?? null
        })

        // ─── Categories ───
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

        // ─── Departments ───
        if (depsSnap.exists()) {
          const d = depsSnap.data().list ?? []
          cacheSet('departments', d)
          setDepartments(d)
        }

        // ─── Thumbnails de logos: fire-and-forget ───
        // Antes esto era bloqueante (Promise.all con await). Ya no: el selector
        // muestra el logo grande mientras los thumbs se generan en background
        // y aparecen al recargar. fetch+canvas son caros, no deben bloquear UI.
        const thumbVersion = cacheGet<number>('thumbVer') ?? 0
        const pending = loaded.filter((c) => c.logo && (!c.logoThumb || thumbVersion < 6))
        if (pending.length) {
          void Promise.all(
            pending.map(async (c) => {
              try {
                const res = await fetch(c.logo!)
                const blob = await res.blob()
                const thumb = await fileToBase64Thumb(new File([blob], 'logo', { type: blob.type }))
                await updateDoc(doc(db, 'companies', c.id), { logoThumb: thumb })
                c.logoThumb = thumb
              } catch { /* skip — will retry next load */ }
            }),
          ).then(() => {
            cacheSet('companies', loaded)
            cacheSet('thumbVer', 6)
          })
        } else {
          cacheSet('thumbVer', 6)
        }
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  // --- Cargar el "access map" del usuario: para cada company, sabemos si es
  // miembro y, si su rol restringe companies, qué companies acepta. Esto deriva
  // `companies` (visible) sin tener que pedirlo en cada lugar del app. El owner
  // bypassea esta lectura porque ignora el filtro. ---
  useEffect(() => {
    if (!user) {
      setCompanyAccess({})
      setAccessLoaded(false)
      return
    }
    if (isOwnerByEmail) {
      // Owner ignora el filtro — sin lecturas innecesarias.
      setAccessLoaded(true)
      return
    }
    if (allCompanies.length === 0) return

    let cancelled = false
    async function loadAccess() {
      if (!user) return
      const uid = user.uid
      try {
        const entries = await Promise.all(
          allCompanies.map(async (c): Promise<[string, CompanyAccessEntry]> => {
            try {
              const memberSnap = await getDoc(doc(db, 'companies', c.id, 'members', uid))
              if (!memberSnap.exists()) return [c.id, { isMember: false }]
              const memberData = memberSnap.data() as { role?: string }
              if (!memberData.role) return [c.id, { isMember: true }]
              const roleSnap = await getDoc(doc(db, 'companies', c.id, 'roles', memberData.role))
              const allowedCompanyIds = roleSnap.exists()
                ? ((roleSnap.data() as { allowedCompanyIds?: string[] }).allowedCompanyIds)
                : undefined
              return [c.id, { isMember: true, allowedCompanyIds }]
            } catch (err) {
              // Sin acceso de lectura por reglas: tratamos como no-miembro.
              console.warn(`[company-access] ${c.id}:`, err)
              return [c.id, { isMember: false }]
            }
          }),
        )
        if (cancelled) return
        const map = Object.fromEntries(entries) as CompanyAccessMap
        setCompanyAccess(map)
        setAccessLoaded(true)
        cacheSet(accessCacheKey(uid), map)
      } catch (err) {
        console.error('[company-access] load failed:', err)
        if (!cancelled) setAccessLoaded(true)
      }
    }
    loadAccess()
    return () => { cancelled = true }
    // Solo re-cargamos cuando cambia el set de ids (no al renombrar una company,
    // que reasigna identidad de `allCompanies` pero no agrega/quita docs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isOwnerByEmail, allCompanies.map((c) => c.id).sort().join('|')])

  // Si la company seleccionada queda fuera de las visibles (por ejemplo,
  // restauramos `selectedCompanyId` de cache que ya no aplica), saltar a la
  // primera visible. Si no hay ninguna, dejar en null → CompanySelectorPage
  // mostrará el empty state.
  useEffect(() => {
    if (!accessLoaded) return
    if (selectedCompany) {
      const isVisible = companies.some((c) => c.id === selectedCompany.id)
      if (isVisible) return
      const fallback = companies[0] ?? null
      setSelectedCompany(fallback)
      if (fallback) cacheSet('selectedCompanyId', fallback.id)
      return
    }
    // No había company previa pero el access ya cargó: si hay visibles, elegir
    // la primera para no quedarnos en pantalla en blanco.
    if (companies.length > 0) {
      setSelectedCompany(companies[0])
      cacheSet('selectedCompanyId', companies[0].id)
    }
  }, [accessLoaded, selectedCompany?.id, companies])

  // Al cambiar de company, limpiar todo el cache React Query scopeado al
  // tenant anterior. `removeQueries` (no `invalidate`) evita refetch de data
  // que ya no se va a usar — un invalidate dispararía refetch de las queries
  // viejas antes de marcarlas como gc-eligibles, gastando lecturas Firestore
  // innecesarias. También reseteamos el dedup de prefetch para permitir el
  // precache del nuevo tenant en el siguiente hover.
  const prevCompanyIdRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevCompanyIdRef.current
    const next = selectedCompany?.id ?? null
    if (prev && prev !== next) {
      queryClient.removeQueries({
        predicate: (q) => {
          const key = q.queryKey as unknown[]
          // Todas nuestras keys scopeadas por tenant tienen el id en la
          // segunda posición: ['firestore', companyId, ...], ['pos-ventas',
          // companyId, ...], ['pos-reconcile-meta', companyId], etc.
          return key.length >= 2 && key[1] === prev
        },
      })
      resetPrefetchCache()
    }
    prevCompanyIdRef.current = next
  }, [selectedCompany?.id])

  // Prefetch de colecciones de Home en cuanto haya company activa.
  // Dispara queries en paralelo a la cascada de providers para que
  // HomePage encuentre data lista (o en vuelo) al montar.
  useEffect(() => {
    if (selectedCompany?.id) prefetchHomeData(selectedCompany.id)
  }, [selectedCompany?.id])

  // Refs a state derivado para que `selectCompany` mantenga identidad estable
  // (los consumers que la guardan en deps no re-renderean en cada cambio).
  const visibleCompaniesRef = useRef(companies)
  useEffect(() => { visibleCompaniesRef.current = companies }, [companies])
  const accessLoadedRef = useRef(accessLoaded)
  useEffect(() => { accessLoadedRef.current = accessLoaded }, [accessLoaded])

  const selectCompany = useCallback((company: Company) => {
    // Si ya cargamos el access y la company no es visible para este usuario,
    // ignorar silenciosamente: evita que un link directo o el cache cliente
    // entren a una company restringida.
    if (accessLoadedRef.current && !visibleCompaniesRef.current.some((c) => c.id === company.id)) {
      return
    }
    setSelectedCompany(company)
    cacheSet('selectedCompanyId', company.id)
  }, [])

  const updateCompany = useCallback(async (id: string, updates: Partial<Pick<Company, 'name' | 'location' | 'color' | 'logo' | 'logoThumb' | 'driveRootFolderId' | 'driveDiscountsFolderId'>>) => {
    const companyRef = doc(db, 'companies', id)
    const data: Record<string, unknown> = { updatedAt: Timestamp.now() }
    for (const [key, val] of Object.entries(updates)) {
      data[key] = val === undefined || val === '' ? deleteField() : val
    }
    await updateDoc(companyRef, data)
    setAllCompanies((prev) => {
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
    setAllCompanies((prev) => {
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
    setAllCompanies((prev) => {
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

  // Memoizamos cada value con sus propias deps. Cuando un usuario edita un
  // departamento, solo `settingsValue` cambia identidad — `companyValue`
  // mantiene la misma referencia y los 49 consumers de useCompany() no
  // re-renderean.
  // `loading` expuesto: para consumers como CompanySelectorPage que necesitan
  // saber si todavía falta filtrar (sin esperar accessLoaded, podrían auto-elegir
  // una company que después desaparece).
  const effectiveLoading = loading || !accessLoaded

  const companyValue = useMemo<CompanyContextValue>(
    () => ({
      companies, allCompanies, selectedCompany,
      loading: effectiveLoading,
      selectCompany, updateCompany, deleteCompany, addCompany,
    }),
    [companies, allCompanies, selectedCompany, effectiveLoading, selectCompany, updateCompany, deleteCompany, addCompany],
  )

  const settingsValue = useMemo<SettingsContextValue>(
    () => ({
      categories, departments,
      addCategory, removeCategory, updateCategory,
      addSubcategory, removeSubcategory, updateSubcategory,
      addDepartment, removeDepartment, updateDepartment,
    }),
    [
      categories, departments,
      addCategory, removeCategory, updateCategory,
      addSubcategory, removeSubcategory, updateSubcategory,
      addDepartment, removeDepartment, updateDepartment,
    ],
  )

  return (
    <CompanyContext.Provider value={companyValue}>
      <SettingsContext.Provider value={settingsValue}>
        {children}
      </SettingsContext.Provider>
    </CompanyContext.Provider>
  )
}
