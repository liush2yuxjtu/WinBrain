import type { SkillDraftRequest, StudioChatMessage } from './types'

export const SKILL_CREATOR_SOURCE = 'https://github.com/anthropics/skills/tree/main/skills/skill-creator'

export function normalizeSkillName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'business-skill'
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

export function fallbackSkillDraft(input: SkillDraftRequest): string {
  const skillName = normalizeSkillName(input.skillName)
  const transcript = formatTranscript(input.transcript)
  const summary = transcript ? transcript.slice(0, 700) : 'No transcript captured yet.'

  return `## SKILL.md
\`\`\`markdown
---
name: ${skillName}
description: Use this skill whenever a ${input.expertRole || 'business expert'} needs help with ${input.businessGoal || 'a recurring business workflow'}, especially when the user asks for repeatable process guidance, decision criteria, output templates, quality review, or examples that should match team-specific practices.
---

# ${skillName}

## Purpose

Help a business expert turn recurring know-how into a consistent workflow that Claude can follow.

## When to use

Use this skill when the user asks about this workflow, wants a repeatable operating procedure, needs a template, or wants Claude to apply team-specific judgment.

## Inputs to gather

- Business objective
- Audience or stakeholder
- Required source data or systems
- Decision criteria
- Output format
- Known exceptions or escalation paths

## Workflow

1. Restate the objective in business language.
2. Ask for missing context one question at a time.
3. Identify the repeatable steps and decision points.
4. Produce the requested business output.
5. Check the output against the stated quality bar.
6. Capture improvements that should be added back into this skill.

## Output format

Use the format requested by the user. If no format is given, provide:

- Summary
- Recommended action
- Supporting rationale
- Risks or open questions
- Next steps

## Quality bar

The output should be specific enough for another team member to execute, avoid unexplained assumptions, and mark any missing context clearly.

## Notes from source conversation

${summary}
\`\`\`

## evals/evals.json
\`\`\`json
{
  "skill_name": "${skillName}",
  "evals": [
    {
      "id": 1,
      "prompt": "I need to handle a real ${input.businessGoal || 'business workflow'} situation. Walk me through what to do and give me the final output format.",
      "expected_output": "The answer gathers missing context, follows the workflow, and produces the requested business artifact.",
      "files": []
    },
    {
      "id": 2,
      "prompt": "Turn this recurring process into a reusable checklist for my team.",
      "expected_output": "The answer produces a team-ready checklist with decision points and exceptions.",
      "files": []
    }
  ]
}
\`\`\`

## Assumptions and open questions
- Confirm the exact stakeholders and approval path.
- Confirm the required source systems and fields.
- Add concrete examples from the expert's day-to-day work.`
}
