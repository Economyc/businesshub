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
import { createPayrollTools } from './payroll-tools.js'
import { createCollectionsTools } from './collections-tools.js'
import { createObligationsTools } from './obligations-tools.js'
import { createClosingTools } from './closing-tools.js'
import { createNotificationsTools } from './notifications-tools.js'
import { createDailyClosingTools } from './daily-closing-tools.js'
import { createMarketingTools } from './marketing-tools.js'
import { createPosTools } from './pos-tools.js'
import { createThreadTools } from './thread-tools.js'
import { createAnomalyTools } from './anomaly-tools.js'
import { createPlanModeTools } from './plan-mode-tools.js'
import { createObsidianTools } from './obsidian-tools.js'
import { createScheduledReportsTools } from './scheduled-reports-tools.js'
import { createContractRagTools } from './contract-rag-tools.js'

export function createAgentTools(companyId: string, threadId?: string) {
  return {
    ...createEmployeeTools(companyId),
    ...createSupplierTools(companyId),
    ...createFinanceTools(companyId),
    ...createAnalysisTools(companyId),
    ...createMutationTools(),
    ...createDocumentTools(companyId),
    ...createAlertsTools(companyId),
    ...createSettingsTools(companyId),
    ...createSearchTools(companyId),
    ...createChartTools(),
    ...createExportTools(),
    // Operator tools
    ...createPayrollTools(companyId),
    ...createCollectionsTools(companyId),
    ...createObligationsTools(companyId),
    ...createClosingTools(companyId),
    // Batch 1 — nuevos
    ...createNotificationsTools(companyId),
    ...createDailyClosingTools(companyId),
    ...createMarketingTools(companyId),
    ...createPosTools(companyId),
    // Wave 4.2 — thread state tool. Sólo activa cuando hay un threadId.
    // Si no, la tool igualmente está registrada pero hace no-op.
    ...createThreadTools(companyId, threadId),
    // Wave 5.1 — anomalías detectadas por el cron diario.
    ...createAnomalyTools(companyId),
    // Wave 5.3 — modo plan: el agente devuelve un plan de N pasos para tareas
    // complejas; el cliente lo renderiza, el usuario aprueba y se ejecutan
    // secuencialmente reusando executeMutation.
    ...createPlanModeTools(),
    // Wave 6.2 — connector outbound a Obsidian. Client-rendered: requiere
    // confirmación humana y endpoint local configurado en el navegador.
    ...createObsidianTools(),
    // Wave 5.2 — reportes programados (CRUD desde el chat).
    ...createScheduledReportsTools(companyId),
    // Wave 4.1 — RAG sobre contratos (search + summarize).
    ...createContractRagTools(companyId),
  }
}
