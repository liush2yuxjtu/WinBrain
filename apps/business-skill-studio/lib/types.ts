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
}

export interface StoredSkillSummary {
  name: string
  title: string
  description: string
  path: string
  updatedAt: string
  sizeBytes: number
  hasEvals: boolean
}

export interface StoredSkillDetail extends StoredSkillSummary {
  skillMarkdown: string
  evalsJson: string | null
}
