export type ComplaintStatus = 'pending' | 'in_progress' | 'waiting_human' | 'completed' | 'cancelled'
export type ComplaintRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface Tipology {
  id: string
  name: string
  code: string
}

export interface Situation {
  id: string
  name: string
}

export interface RegulatoryAction {
  id: string
  name: string
  code: string
}

export interface ComplaintDetail {
  id: string
  fieldName: string
  fieldValue: string
  fieldType: string
  confidence: number | null
  source: string
  createdAt: string
}

export interface ComplaintHistory {
  id: string
  action: string
  description: string | null
  previousStatus: string | null
  newStatus: string | null
  performedBy: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface ComplaintAttachment {
  id: string
  fileName: string
  fileUrl: string
  mimeType: string
  createdAt: string
}

export interface Complaint {
  id: string
  protocolNumber: string
  rawText: string
  normalizedText: string | null
  status: ComplaintStatus
  riskLevel: ComplaintRiskLevel
  slaDeadline: string | null
  slaBusinessDays: number | null
  isOverdue: boolean
  source: string
  externalId: string | null
  procedente: boolean | null
  tipology: Tipology | null
  subtipology: { id: string; name: string } | null
  situation: Situation | null
  regulatoryAction: RegulatoryAction | null
  details: ComplaintDetail[]
  history: ComplaintHistory[]
  attachments: ComplaintAttachment[]
  createdAt: string
  updatedAt: string
}

export interface ComplaintListResponse {
  data: Complaint[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface Execution {
  id: string
  status: string
  createdAt: string
  steps?: ExecutionStep[]
}

export interface ExecutionStep {
  id: string
  name: string
  status: string
  output: unknown
  createdAt: string
}

export interface Artifact {
  id: string
  type: string
  name: string
  content: unknown
  createdAt: string
}
