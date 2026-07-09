# Project skills

Project-level skills installed from verified upstream sources. `.agents/` is the primary project agent directory; `.codex/` mirrors this directory for Codex compatibility.

## Installed skills

- `supabase` — official Supabase product, CLI, MCP, auth, RLS, migrations, and security guidance.
- `supabase-postgres-best-practices` — official Supabase Postgres optimization and schema guidance.
- `vercel-ai-gateway` — official Vercel AI Gateway guidance, condensed from the upstream skill.
- `vercel-ai-sdk` — official Vercel AI SDK guidance, condensed from the upstream skill.
- `skill-creator` — Anthropic skill creation workflow for drafting SKILL.md, evals, and iterative improvements.
- `playwright-cli` — project browser automation, screenshots, video recording, and PR evidence guidance.
- `knowledge-work-plugins` — mirrored skill trees from `anthropics/knowledge-work-plugins` under `knowledge-work-plugins/upstream/`.

## Source policy

- Supabase skills are vendored from `supabase-community/supabase-plugin`, whose README states the repo supports Codex and shares `skills/` across vendors.
- Vercel skills are derived from `vercel/vercel-plugin`. The full plugin contains commands, agents, hooks, and generated skill manifests; this project-level copy installs safe, readable skill guidance only.
- Anthropic's `claude-plugins-official` marketplace is recorded under both `.agents/plugins/claude-plugins-official/` and `.codex/plugins/claude-plugins-official/` as an upstream registry source.
- Anthropic's `knowledge-work-plugins` repository is vendored under `.agents/plugins/knowledge-work-plugins/upstream/`; its `skills/` directories are mirrored under `.agents/skills/knowledge-work-plugins/upstream/`.
- Anthropic's `skill-creator` skill is installed under both `.agents/skills/skill-creator/` and `.codex/skills/skill-creator/`.

The `user_upload/` tree is intentionally untouched because `user_upload/AGENTS.md` forbids agent edits there.
