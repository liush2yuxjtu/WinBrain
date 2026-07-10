import type { SkillDraftRequest, StudioChatMessage } from './types'

export const SKILL_CREATOR_SOURCE = 'https://github.com/anthropics/skills/tree/main/skills/skill-creator'

export function normalizeSkillName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'business-skill'
}

export function formatTranscript(messages: StudioChatMessage[]): string {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n')
}

export function buildSkillCreatorSystemPrompt(): string {
  return [
    'You are WinBrain Skill Studio, an assistant that helps business experts convert practical know-how into reusable Claude skills.',
    'Follow the official Anthropic skill-creator workflow: capture intent, interview for edge cases, draft SKILL.md, propose test prompts, then iterate based on expert feedback.',
    'A skill must include YAML frontmatter with name and description. The description is the primary triggering mechanism; make it explicit about when the skill should be used.',
    'Keep SKILL.md concise and use progressive disclosure: put detailed procedures, examples, and references in separate files when the skill grows too large.',
    'Do not invent company policy. Ask for missing business rules or mark them as assumptions.',
    'Do not include secrets, credentials, private customer data, malware, exploit steps, or unauthorized access instructions in generated skills.',
    'When the user asks to generate a draft, return a clear SKILL.md section and a small evals/evals.json proposal.'
  ].join('\n')
}

export function buildBusinessChatSystemPrompt(expertRole = 'business expert', businessContext = '', activeSkillDraft = ''): string {
  return [
    `You are chatting with a ${expertRole}.`,
    'Your job is to help them describe recurring work, decisions, terminology, exceptions, and quality bars so those can become reusable Claude skills.',
    'Ask one focused question at a time when information is missing. Prefer concrete examples from their daily work.',
    'When you identify reusable know-how, summarize it as candidate skill material: triggers, workflow, inputs, outputs, edge cases, and evaluation prompts.',
    businessContext ? `Business context:\n${businessContext}` : '',
    activeSkillDraft ? `Current skill draft to refine:\n${activeSkillDraft}` : ''
  ].filter(Boolean).join('\n\n')
}

export function buildSkillDraftPrompt(input: SkillDraftRequest): string {
  const skillName = normalizeSkillName(input.skillName)
  const transcript = formatTranscript(input.transcript)

  return `Create a draft Claude skill from this business expert conversation.

Skill name: ${skillName}
Expert role: ${input.expertRole}
Business goal: ${input.businessGoal}

Conversation transcript:
${transcript || '(No transcript provided.)'}

Return the result in this exact structure:

## SKILL.md
\`\`\`markdown
---
name: ${skillName}
description: <pushy trigger description: when to use this skill, what it helps with, key contexts and phrases>
---

# <Skill Title>

## Purpose

## When to use

## Inputs to gather

## Workflow

## Output format

## Quality bar

## Edge cases
\`\`\`

## evals/evals.json
\`\`\`json
{
  "skill_name": "${skillName}",
  "evals": [
    {
      "id": 1,
      "prompt": "A realistic user prompt that should trigger the skill",
      "expected_output": "What good output should contain",
      "files": []
    }
  ]
}
\`\`\`

## Assumptions and open questions
- <List what the expert still needs to confirm>`
}
