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
}

export interface StoredSkillSummary {
  name: string
  path: string
  updatedAt: string
}
