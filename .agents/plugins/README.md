# Project plugins

Installed project-level plugin manifests and source references. `.agents/` is the primary project agent directory; `.codex/` mirrors this directory for Codex compatibility.

## Installed

- `vercel` — official Vercel Claude/Codex-compatible plugin source: `https://github.com/vercel/vercel-plugin`
- `supabase` — official Supabase plugin distribution source: `https://github.com/supabase-community/supabase-plugin`
- `claude-plugins-official` — vendored Anthropic official Claude Code plugin marketplace source: `https://github.com/anthropics/claude-plugins-official`
- `agent-sdk-dev` — Anthropic Agent SDK development plugin used by `apps/business-skill-studio`
- `knowledge-work-plugins` — vendored Anthropic Knowledge Work Plugins source: `https://github.com/anthropics/knowledge-work-plugins`

## Notes

The Anthropic official marketplace is vendored under `.agents/plugins/claude-plugins-official/upstream/plugins/` (37 bundled plugins, pinned to commit `c78da81119b6295856638784432e4f85902123d6`). The bundled tree includes 22 third-party executable hooks under `*/hooks/*`; treat them as unvetted code until individually audited — see `plugin-registry.json` and `VENDORED_FROM.md` for the per-plugin hook count and the pin.

The Knowledge Work Plugins repository is vendored under `.agents/plugins/knowledge-work-plugins/upstream/` with mirrored skill trees under `.agents/skills/knowledge-work-plugins/upstream/`.

The `user_upload/` tree is intentionally untouched because `user_upload/AGENTS.md` forbids agent edits there.
