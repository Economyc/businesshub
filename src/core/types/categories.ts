export interface CategoryItem {
  id: string
  name: string
  color: string
  subcategories: string[]
}

export interface ParsedCategory {
  category: string
  subcategory?: string
}
