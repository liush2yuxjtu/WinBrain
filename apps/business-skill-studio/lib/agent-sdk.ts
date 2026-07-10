// Compatibility shim for existing imports. The live provider now uses MiniMax's
// Anthropic-compatible Messages API rather than spawning the Claude Agent SDK.
export { draftSkillWithAgent, runAgentChat } from './model-provider'
export type { LiveModelProvider, LiveModelResult } from './model-provider'
