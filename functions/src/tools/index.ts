import { createEmployeeTools } from './employee-tools.js'
import { createSupplierTools } from './supplier-tools.js'
import { createFinanceTools } from './finance-tools.js'
import { createAnalysisTools } from './analysis-tools.js'
import { createMutationTools } from './mutation-tools.js'
import { createDocumentTools } from './document-tools.js'
import { createAlertsTools } from './alerts-tools.js'
import { createSettingsTools } from './settings-tools.js'
import { createSearchTools } from './search-tools.js'
import { createChartTools } from './chart-tools.js'
import { createExportTools } from './export-tools.js'

export function createAgentTools(companyId: string) {
  return {
    ...createEmployeeTools(companyId),
    ...createSupplierTools(companyId),
    ...createFinanceTools(companyId),
    ...createAnalysisTools(companyId),
    ...createMutationTools(),
    ...createDocumentTools(companyId),
    ...createAlertsTools(companyId),
    ...createSettingsTools(),
    ...createSearchTools(companyId),
    ...createChartTools(),
    ...createExportTools(),
  }
}
