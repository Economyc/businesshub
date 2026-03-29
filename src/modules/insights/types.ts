export interface KPIData {
  totalEmployees: number
  totalSuppliers: number
  totalIncome: number
  totalExpenses: number
  totalPurchases: number
  balance: number
  employeeChange: string
  supplierChange: string
  expenseChange: string
  purchaseChange: string
  balanceChange: string
}

export interface TrendPoint {
  month: string
  income: number
  expenses: number
  purchases: number
}

export interface CategoryData {
  category: string
  amount: number
  color?: string
}

export interface SupplierBreakdownData {
  name: string
  total: number
  count: number
}
