# Agent SDK Development Plugin

Project-level copy of Anthropic's `agent-sdk-dev` plugin reference for building and verifying Claude Agent SDK applications.

## Source

- Repository: `anthropics/claude-plugins-official`
- Path: `plugins/agent-sdk-dev`

## Included components

- `.claude-plugin/plugin.json` — plugin metadata
- `commands/new-sdk-app.md` — guidance for creating new TypeScript/Python Agent SDK apps
- `agents/agent-sdk-verifier-ts.md` — TypeScript Agent SDK verifier guidance

## How this repository uses it

The `apps/business-skill-studio` MVP follows the plugin's TypeScript app pattern:

1. Uses `@anthropic-ai/claude-agent-sdk` as the server-side chat adapter.
2. Provides `package.json`, `tsconfig.json`, `.env.example`, and `.gitignore`.
3. Keeps API keys out of source control.
4. Includes a `typecheck` script for verification.
5. Uses a verifier-oriented checklist before production deployment.

For full upstream behavior, install from the official marketplace or sync from `anthropics/claude-plugins-official/plugins/agent-sdk-dev`.
