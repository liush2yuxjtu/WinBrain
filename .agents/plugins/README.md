# Project plugins

Installed project-level plugin manifests and source references. `.agents/` is the primary project agent directory; `.codex/` mirrors this directory for Codex compatibility.

## Installed

- `vercel` — official Vercel Claude/Codex-compatible plugin source: `https://github.com/vercel/vercel-plugin`
- `supabase` — official Supabase plugin distribution source: `https://github.com/supabase-community/supabase-plugin`
- `claude-plugins-official` — Anthropic official Claude Code plugin marketplace source: `https://github.com/anthropics/claude-plugins-official`

## Notes

The Anthropic marketplace contains many partner/community plugin entries. To avoid vendoring large external repositories and executable hooks into this repository without review, this directory records the official marketplace source and installs the verified Vercel and Supabase plugin manifests directly.

The `user_upload/` tree is intentionally untouched because `user_upload/AGENTS.md` forbids agent edits there.
