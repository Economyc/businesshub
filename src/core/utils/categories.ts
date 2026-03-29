import type { CategoryItem, ParsedCategory } from '@/core/types/categories'

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function formatCategory(category: string, subcategory?: string): string {
  if (subcategory) return `${category} > ${subcategory}`
  return category
}

export function parseCategory(value: string): ParsedCategory {
  const parts = value.split(' > ')
  return {
    category: parts[0],
    subcategory: parts[1],
  }
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'ventas', name: 'Ventas', color: '#27AE60', subcategories: ['Productos', 'Servicios', 'Devoluciones'] },
  { id: 'nomina', name: 'Nómina', color: '#E67E22', subcategories: ['Salarios', 'Prestaciones', 'Bonos'] },
  { id: 'servicios', name: 'Servicios', color: '#3498DB', subcategories: ['Agua', 'Luz', 'Internet', 'Gas', 'Teléfono'] },
  { id: 'alquiler', name: 'Alquiler', color: '#9B59B6', subcategories: ['Local', 'Bodega', 'Oficina'] },
  { id: 'suministros', name: 'Suministros', color: '#1ABC9C', subcategories: ['Insumos', 'Papelería', 'Limpieza'] },
  { id: 'marketing', name: 'Marketing', color: '#E74C3C', subcategories: ['Publicidad', 'Redes sociales', 'Eventos'] },
  { id: 'impuestos', name: 'Impuestos', color: '#34495E', subcategories: ['IVA', 'Renta', 'Retenciones'] },
  { id: 'seguros', name: 'Seguros', color: '#F39C12', subcategories: ['Salud', 'Propiedad', 'Vehículos'] },
  { id: 'transporte', name: 'Transporte', color: '#2C3E50', subcategories: ['Combustible', 'Envíos', 'Viáticos'] },
  { id: 'otros', name: 'Otros', color: '#95A5A6', subcategories: [] },
]

const DEFAULT_COLORS = [
  '#27AE60', '#E67E22', '#3498DB', '#9B59B6', '#1ABC9C',
  '#E74C3C', '#34495E', '#F39C12', '#2C3E50', '#95A5A6',
]

const DEFAULT_SUBCATEGORIES: Record<string, string[]> = {
  'Ventas': ['Productos', 'Servicios', 'Devoluciones'],
  'Nómina': ['Salarios', 'Prestaciones', 'Bonos'],
  'Servicios': ['Agua', 'Luz', 'Internet', 'Gas', 'Teléfono'],
  'Alquiler': ['Local', 'Bodega', 'Oficina'],
  'Suministros': ['Insumos', 'Papelería', 'Limpieza'],
  'Marketing': ['Publicidad', 'Redes sociales', 'Eventos'],
  'Impuestos': ['IVA', 'Renta', 'Retenciones'],
  'Seguros': ['Salud', 'Propiedad', 'Vehículos'],
  'Transporte': ['Combustible', 'Envíos', 'Viáticos'],
}

export function migrateOldCategories(oldList: string[]): CategoryItem[] {
  return oldList.map((name, i) => ({
    id: slugify(name),
    name,
    color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    subcategories: DEFAULT_SUBCATEGORIES[name] ?? [],
  }))
}
