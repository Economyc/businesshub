// Wave 5.2 — Reportes programados.
//
// CRUD sobre `companies/{companyId}/scheduledReports/{id}`. Sigue el mismo
// patrón que el resto de servicios del repo (helpers de `core/firebase`).

import { orderBy } from 'firebase/firestore'
import {
  fetchCollection,
  createDocument,
  updateDocument,
  removeDocument,
} from '@/core/firebase/helpers'
import type { ScheduledReport, ScheduledReportFormData } from './types'

const COLLECTION = 'scheduledReports'

export const scheduledReportService = {
  list: (companyId: string) =>
    fetchCollection<ScheduledReport>(companyId, COLLECTION, orderBy('createdAt', 'desc')),

  create: (companyId: string, data: ScheduledReportFormData) =>
    createDocument(companyId, COLLECTION, data),

  update: (companyId: string, id: string, data: Partial<ScheduledReportFormData>) =>
    updateDocument(companyId, COLLECTION, id, data),

  toggle: (companyId: string, id: string, enabled: boolean) =>
    updateDocument(companyId, COLLECTION, id, { enabled }),

  remove: (companyId: string, id: string) =>
    removeDocument(companyId, COLLECTION, id),
}
