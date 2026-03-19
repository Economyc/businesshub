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
