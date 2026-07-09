# Project architecture and frontend audit

Date: 2026-07-09
Repository: `liush2yuxjtu/WinBrain`
Branch audited: `main`

## Current architecture observed

The repository currently appears to be an agent configuration / project-skill workspace rather than an application repository.

Observed structure:

```text
.agents/
  plugins/
  skills/
.codex/
  plugins/
  skills/
.github/
  workflows/
user_upload/
  AGENTS.md
```

Key points:

- `.agents/` is the primary project-level agent directory.
- `.codex/` mirrors `.agents/` for Codex compatibility.
- Existing skills include Supabase, Vercel, Knowledge Work, and Playwright CLI guidance.
- `user_upload/` is protected by its own `AGENTS.md`; agents must not edit content there.

## Frontend audit

No runnable frontend entry point was detected before this Playwright instrumentation work.

Checked missing common frontend files before instrumentation:

```text
package.json
index.html
```

No obvious frontend app entry point such as Vite, Next.js, React source files, or static HTML was found through the available GitHub connector checks.

## Implication for recording

Because no frontend app is present yet, the Playwright recorder behaves as follows:

1. Use `FRONTEND_URL` when explicitly provided.
2. Optionally run `FRONTEND_START_COMMAND` and auto-detect common local ports.
3. Check common frontend URLs such as `5173`, `3000`, `4173`, and `8080`.
4. If no frontend is reachable, record a diagnostic fallback page that explains no frontend was found.

## Installed

```text
package.json
playwright.config.ts
tools/record-frontend.mjs
tests/frontend-smoke.spec.ts
.github/workflows/frontend-recording.yml
.agents/skills/playwright-cli/SKILL.md
.codex/skills/playwright-cli/SKILL.md
```

## Review fixes applied

- Spawned frontend processes now use `detached: true` on non-Windows systems.
- Diagnostic fallback target now carries the spawned frontend process so cleanup still runs.
- Browser, context, and frontend processes are cleaned up in `finally`.
- Recording failures set `process.exitCode = 1` and write a failure summary.
- Playwright dependencies are pinned to `1.49.0` instead of `latest`.

## How to record the real frontend later

After a real frontend is added, run one of:

```bash
FRONTEND_URL=http://127.0.0.1:5173 npm run record:frontend
```

or:

```bash
FRONTEND_START_COMMAND="npm run dev -- --host 127.0.0.1" npm run record:frontend
```

The generated artifacts are written to:

```text
artifacts/frontend-recording/
```

The CI workflow uploads that directory as the `frontend-playwright-recording` artifact on pull requests.
