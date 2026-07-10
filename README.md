# WinBrain

This repository is configured with Playwright-based PR evidence automation and project-level agent assets under `.agents/` with `.codex/` mirrors for Codex compatibility.

## Apps

### Business Skill Studio

`apps/business-skill-studio` is a Next.js MVP that lets business experts chat with AI and turn recurring expert workflows into reusable Claude skills.

It uses these project-level assets:

- `.agents/skills/skill-creator/` — Anthropic-inspired workflow for drafting `SKILL.md` and `evals/evals.json`.
- `.agents/plugins/agent-sdk-dev/` — Agent SDK development plugin reference for TypeScript app setup and verification.
- `.agents/plugins/knowledge-work-plugins/` — vendored Anthropic Knowledge Work Plugins source registry and skill tree references.

Run locally:

```bash
cd apps/business-skill-studio
npm install
cp .env.example .env.local
npm run dev
```

Set at least one supported Claude Agent SDK credential in `.env.local`. Missing credentials return HTTP 503, and exhausted credentials return an explicit stream error; the app never substitutes deterministic chat or Skill content.

## What happens on every PR

When a pull request is opened, updated, reopened, or marked ready for review, GitHub Actions runs `.github/workflows/playwright-pr-evidence.yml`.

The workflow:

1. Installs root and Business Skill Studio dependencies.
2. Starts the real Business Skill Studio locally and verifies that it is reachable.
3. Installs Chromium and required Playwright system dependencies.
4. Runs `npm run test:e2e` against the running application.
5. Uploads Playwright evidence as a GitHub Actions artifact.
6. Updates the PR body with a `Playwright evidence` section that links to the workflow run and downloadable artifact.

The artifact includes:

- `artifacts/playwright-html-report/` — HTML report.
- `artifacts/playwright-output/` — Playwright videos, traces, and failure screenshots.
- `artifacts/screenshots/` — the always-captured PR evidence screenshot.
- `artifacts/business-skill-studio.log` — application startup diagnostics.

## Local usage

Install dependencies:

```bash
npm install
npm install --prefix apps/business-skill-studio --legacy-peer-deps
npx playwright install --with-deps chromium
```

Start a real application target, then run Playwright with its URL:

```bash
PLAYWRIGHT_TARGET_URL=http://127.0.0.1:3000/login npm run test:e2e
```

`PLAYWRIGHT_TARGET_URL` is mandatory and must use HTTP or HTTPS. The test fails when no real target is configured; it does not open `demo/index.html` or any generated diagnostic page.

Open the HTML report:

```bash
npm run test:e2e:report
```

Run in headed mode for debugging:

```bash
PLAYWRIGHT_TARGET_URL=http://127.0.0.1:3000/login npm run test:e2e:headed
```

## How to prompt Codex Cloud

Use a task prompt like this:

```text
Implement the requested change. Before opening the PR, install dependencies if needed, start the real application, set PLAYWRIGHT_TARGET_URL to that application, run npm run test:e2e, and inspect the Playwright report. Do not commit generated files from artifacts/, test-results/, or playwright-report/. After the PR is opened, GitHub Actions will upload screenshots/videos and update the PR body.
```

## Important limitation

GitHub PR bodies are Markdown. The workflow writes links to the uploaded artifact into the PR body. For inline images/videos directly visible in the body, the media needs a stable URL, such as GitHub Pages, object storage, or a file committed to the PR branch. The current setup publishes selected evidence media to the PR branch and also retains the complete artifact backup.
