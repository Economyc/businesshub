export interface AnalyticsKPIs {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  profitMargin: number
  totalPurchases: number
  incomeChange: string
  expenseChange: string
  profitChange: string
  marginChange: string
  purchaseChange: string
}

export interface CostStructureKPIs {
  totalCost: number
  fixedCost: number
  variableCost: number
  fixedRatio: number
  variableRatio: number
  totalChange: string
  fixedChange: string
  variableChange: string
}

export interface PurchaseAnalyticsKPIs {
  totalPurchases: number
  orderCount: number
  avgTicket: number
  activeSuppliers: number
  totalChange: string
  orderChange: string
  ticketChange: string
  supplierChange: string
}

export interface PayrollKPIs {
  totalPayroll: number
  employeeCount: number
  avgSalary: number
  payrollToIncomeRatio: number
  payrollChange: string
  employeeChange: string
  salaryChange: string
  ratioChange: string
}

export interface CategoryCost {
  category: string
  amount: number
  percentage: number
  color?: string
}

export interface MonthlyDataPoint {
  month: string
  income: number
  expenses: number
  purchases: number
}

export interface MonthlyCostPoint {
  month: string
  [category: string]: string | number
}

export interface SupplierData {
  name: string
  total: number
  count: number
}

export interface ProductData {
  name: string
  quantity: number
  total: number
}

export interface DepartmentPayroll {
  department: string
  total: number
  count: number
}

export interface RolePayroll {
  role: string
  total: number
  count: number
}
