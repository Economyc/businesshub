import { slugify, formatCategory, parseCategory, migrateOldCategories, DEFAULT_CATEGORIES } from './categories'

describe('slugify', () => {
  it('lowercases input', () => {
    expect(slugify('HELLO')).toBe('hello')
  })

  it('removes diacritics/accents', () => {
    expect(slugify('Nómina')).toBe('nomina')
  })

  it('replaces non-alphanumeric chars with hyphens', () => {
    expect(slugify('hello world!')).toBe('hello-world')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('--test--')).toBe('test')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('handles complex accented strings', () => {
    expect(slugify('Información Básica')).toBe('informacion-basica')
  })
})

describe('formatCategory', () => {
  it('returns category alone when no subcategory', () => {
    expect(formatCategory('Ventas')).toBe('Ventas')
  })

  it('returns "category > subcategory" format', () => {
    expect(formatCategory('Ventas', 'Productos')).toBe('Ventas > Productos')
  })
})

describe('parseCategory', () => {
  it('splits "Ventas > Productos" correctly', () => {
    const result = parseCategory('Ventas > Productos')
    expect(result).toEqual({ category: 'Ventas', subcategory: 'Productos' })
  })

  it('handles single category without subcategory', () => {
    const result = parseCategory('Ventas')
    expect(result.category).toBe('Ventas')
    expect(result.subcategory).toBeUndefined()
  })
})

describe('migrateOldCategories', () => {
  it('converts string array to CategoryItem array', () => {
    const result = migrateOldCategories(['Ventas', 'Nómina'])
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ id: 'ventas', name: 'Ventas' })
    expect(result[1]).toMatchObject({ id: 'nomina', name: 'Nómina' })
  })

  it('assigns known subcategories from defaults', () => {
    const result = migrateOldCategories(['Ventas'])
    expect(result[0].subcategories).toEqual(['Productos', 'Servicios', 'Devoluciones'])
  })

  it('assigns empty subcategories for unknown categories', () => {
    const result = migrateOldCategories(['CustomCat'])
    expect(result[0].subcategories).toEqual([])
  })

  it('cycles colors when list exceeds DEFAULT_COLORS length', () => {
    const names = Array.from({ length: 12 }, (_, i) => `Cat${i}`)
    const result = migrateOldCategories(names)
    // Colors cycle at 10 (DEFAULT_COLORS.length)
    expect(result[0].color).toBe(result[10].color)
    expect(result[1].color).toBe(result[11].color)
  })
})

describe('DEFAULT_CATEGORIES', () => {
  it('has 10 default categories', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(10)
  })

  it('each category has id, name, color, and subcategories', () => {
    for (const cat of DEFAULT_CATEGORIES) {
      expect(cat.id).toBeTruthy()
      expect(cat.name).toBeTruthy()
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(Array.isArray(cat.subcategories)).toBe(true)
    }
  })
})
