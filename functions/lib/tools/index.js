import { createEmployeeTools } from './employee-tools.js';
import { createSupplierTools } from './supplier-tools.js';
import { createFinanceTools } from './finance-tools.js';
import { createAnalysisTools } from './analysis-tools.js';
import { createMutationTools } from './mutation-tools.js';
import { createDocumentTools } from './document-tools.js';
import { createAlertsTools } from './alerts-tools.js';
import { createSettingsTools } from './settings-tools.js';
import { createSearchTools } from './search-tools.js';
import { createChartTools } from './chart-tools.js';
import { createExportTools } from './export-tools.js';
import { createPayrollTools } from './payroll-tools.js';
import { createCollectionsTools } from './collections-tools.js';
import { createObligationsTools } from './obligations-tools.js';
import { createClosingTools } from './closing-tools.js';
export function createAgentTools(companyId) {
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
        // Operator tools
        ...createPayrollTools(companyId),
        ...createCollectionsTools(companyId),
        ...createObligationsTools(companyId),
        ...createClosingTools(companyId),
    };
}
//# sourceMappingURL=index.js.map