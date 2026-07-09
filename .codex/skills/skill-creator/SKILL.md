---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when a user wants to turn business expertise, recurring workflows, team playbooks, output templates, or expert judgment into a reusable Claude skill with SKILL.md and evals.
metadata:
  author: Anthropic
  source: https://github.com/anthropics/skills/tree/main/skills/skill-creator
---

# Skill Creator

Use this skill to help a business expert turn tacit knowledge into a reusable Claude skill.

## Core workflow

1. **Capture intent**
   - What should this skill enable Claude to do?
   - When should it trigger?
   - What output format should it produce?
   - What test cases would prove it works?

2. **Interview and research**
   - Ask one focused question at a time.
   - Elicit real examples, edge cases, source systems, approval rules, failure modes, and quality standards.
   - Do not invent company policy; mark assumptions and ask the expert to confirm.

3. **Write SKILL.md**
   - Include YAML frontmatter with `name` and `description`.
   - Make the description explicit and trigger-oriented.
   - Keep the body concise; use `references/`, `scripts/`, or `assets/` for larger resources.

4. **Create evals**
   - Draft 2-3 realistic prompts in `evals/evals.json`.
   - Include expected output descriptions.
   - Prefer concrete, business-realistic prompts over abstract toy prompts.

5. **Iterate**
   - Show the expert the skill and test prompts.
   - Capture feedback.
   - Update the skill until the expert agrees it is useful and repeatable.

## Standard skill structure

```text
skill-name/
├── SKILL.md
├── evals/
│   └── evals.json
├── references/
├── scripts/
└── assets/
```

## Safety and quality rules

- Do not include secrets, credentials, private customer data, or unauthorized access steps.
- Do not create misleading or deceptive skills.
- Explain why the workflow matters instead of relying on brittle all-caps rules.
- Prefer reusable principles and decision criteria over overfitting to a single example.

## Business Skill Studio adaptation

For `apps/business-skill-studio`, use the chat transcript as the interview record. Generate:

1. `SKILL.md`
2. `evals/evals.json`
3. assumptions and open questions for the business expert to confirm

The user-facing app can save drafts locally, then a future packaging step can convert the directory into a `.skill` artifact.
