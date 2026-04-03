import { createEmployeeTools } from './employee-tools.js';
import { createSupplierTools } from './supplier-tools.js';
import { createFinanceTools } from './finance-tools.js';
import { createAnalysisTools } from './analysis-tools.js';
import { createMutationTools } from './mutation-tools.js';
export function createAgentTools(companyId) {
    return {
        ...createEmployeeTools(companyId),
        ...createSupplierTools(companyId),
        ...createFinanceTools(companyId),
        ...createAnalysisTools(companyId),
        ...createMutationTools(),
    };
}
//# sourceMappingURL=index.js.map