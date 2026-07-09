# Project skills

Project-level skills installed from verified upstream sources. `.agents/` is the primary project agent directory; `.codex/` mirrors this directory for Codex compatibility.

## Installed skills

- `supabase` — official Supabase product, CLI, MCP, auth, RLS, migrations, and security guidance.
- `supabase-postgres-best-practices` — official Supabase Postgres optimization and schema guidance.
- `vercel-ai-gateway` — official Vercel AI Gateway guidance, condensed from the upstream skill.
- `vercel-ai-sdk` — official Vercel AI SDK guidance, condensed from the upstream skill.

## Source policy

- Supabase skills are vendored from `supabase-community/supabase-plugin`, whose README states the repo supports Codex and shares `skills/` across vendors.
- Vercel skills are derived from `vercel/vercel-plugin`. The full plugin contains commands, agents, hooks, and generated skill manifests; this project-level copy installs safe, readable skill guidance only.
- Anthropic's `claude-plugins-official` marketplace is recorded under both `.agents/plugins/claude-plugins-official/` and `.codex/plugins/claude-plugins-official/` as an upstream registry source.

The `user_upload/` tree is intentionally untouched because `user_upload/AGENTS.md` forbids agent edits there.
