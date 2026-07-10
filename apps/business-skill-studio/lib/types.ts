export type ChatRole = 'system' | 'user' | 'assistant'

export interface StudioChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
}

export interface ChatRequest {
  messages: StudioChatMessage[]
  expertRole?: string
  businessContext?: string
  activeSkillDraft?: string
}

export interface ChatResponse {
  message: StudioChatMessage
  usedLiveModel: boolean
  usedAgentSdk: boolean
  provider: string
  credentialSlot?: 'primary' | 'fallback' | 'legacy'
  warnings: string[]
}

export interface SkillDraftRequest {
  skillName: string
  expertRole: string
  businessGoal: string
  transcript: StudioChatMessage[]
}

export interface SkillSaveRequest {
  skillName: string
  skillMarkdown: string
  evalsJson?: string
  overwrite?: boolean
  organizationId?: string
  expertId?: string
}

export interface StoredSkillSummary {
  id: string
  name: string
  slug: string
  version: number
  title: string
  description: string
  updatedAt: string
  sizeBytes: number
  hasEvals: boolean
  organizationId?: string
  expertId?: string
}

export interface StoredSkillDetail extends StoredSkillSummary {
  skillMarkdown: string
  evalsJson: string | null
}

export interface OrganizationSummary {
  id: string
  slug: string
  name: string
  industry?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface ExpertSummary {
  id: string
  organizationId: string
  name: string
  email?: string
  role: string
  department?: string
  expertise?: string
  businessContext?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CustomerDataSourceKind = 'MYSQL' | 'OCEANBASE_MYSQL'
export type CustomerDataSourceSslMode = 'DISABLED' | 'REQUIRED'
export type CustomerDataSourceHealth = 'UNTESTED' | 'HEALTHY' | 'WARNING' | 'FAILED'

export interface CustomerDataSourceConnectionInput {
  kind: CustomerDataSourceKind
  host: string
  port: number
  username: string
  password: string
  databaseName: string
  charset: string
  sslMode: CustomerDataSourceSslMode
}

export interface CustomerDataSourceCreateRequest extends CustomerDataSourceConnectionInput {
  organizationId: string
  expertId?: string
  name: string
}

export interface CustomerDataSourceSummary {
  id: string
  organizationId: string
  expertId?: string
  name: string
  kind: CustomerDataSourceKind
  host: string
  port: number
  username: string
  databaseName: string
  charset: string
  sslMode: CustomerDataSourceSslMode
  lastStatus: CustomerDataSourceHealth
  lastTestedAt?: string
  lastLatencyMs?: number
  lastTableCount?: number
  lastServerVersion?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export interface CustomerDatabaseColumn {
  name: string
  dataType: string
  nullable: boolean
  key?: string
}

export interface CustomerDatabaseTable {
  name: string
  type: string
  estimatedRows?: number
  columns: CustomerDatabaseColumn[]
}

export interface CustomerDatabaseTestStep {
  key: 'validate' | 'resolve' | 'connect' | 'ping' | 'permissions' | 'schema'
  label: string
  status: 'passed' | 'warning' | 'failed'
  detail: string
}

export interface CustomerDatabaseTestResult {
  status: Exclude<CustomerDataSourceHealth, 'UNTESTED'>
  latencyMs?: number
  serverVersion?: string
  currentDatabase?: string
  tableCount?: number
  readOnlyInferred: boolean
  warnings: string[]
  error?: string
  resolvedAddress?: string
  grants: string[]
  tables: CustomerDatabaseTable[]
  steps: CustomerDatabaseTestStep[]
}

export interface CompanySetupPayload {
  organizations: OrganizationSummary[]
  experts: ExpertSummary[]
  dataSources: CustomerDataSourceSummary[]
}
