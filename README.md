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

Set `ANTHROPIC_API_KEY` in `.env.local` to enable Agent SDK-backed chat. Without it, the app uses deterministic fallback behavior so the UI and skill flow remain reviewable.

## What happens on every PR

When a pull request is opened, updated, reopened, or marked ready for review, GitHub Actions runs `.github/workflows/playwright-pr-evidence.yml`.

The workflow:

1. Installs Node dependencies.
2. Installs Chromium and required Playwright system dependencies.
3. Runs `npm run test:e2e`.
4. Uploads Playwright evidence as a GitHub Actions artifact.
5. Updates the PR body with a `Playwright evidence` section that links to the workflow run and downloadable artifact.

The artifact includes:

- `playwright-report/` — HTML report.
- `test-results/` — Playwright videos, traces, and failure screenshots.
- `artifacts/screenshots/` — the always-captured PR evidence screenshot.

## Local usage

Install dependencies:

```bash
npm install
npx playwright install --with-deps chromium
```

Run Playwright:

```bash
npm run test:e2e
```

Open the HTML report:

```bash
npm run test:e2e:report
```

Run in headed mode for debugging:

```bash
npm run test:e2e:headed
```

## Capturing the real app instead of the fallback page

The current smoke test captures `demo/index.html` unless `PLAYWRIGHT_TARGET_URL` is set.

For GitHub Actions, set a repository variable:

1. Go to repository **Settings**.
2. Open **Secrets and variables** → **Actions** → **Variables**.
3. Add `PLAYWRIGHT_TARGET_URL` with your deployed preview URL, for example `https://your-preview.example.com`.

For Codex Cloud, set the same variable in the Codex environment if you want the agent to run the same target URL while validating locally inside the cloud task.

## How to prompt Codex Cloud

Use a task prompt like this:

```text
Implement the requested change. Before opening the PR, install dependencies if needed, run `npm run test:e2e`, and inspect the Playwright report. Do not commit generated files from `artifacts/`, `test-results/`, or `playwright-report/`. After the PR is opened, GitHub Actions will upload screenshots/videos and update the PR body.
```

## Important limitation

GitHub PR bodies are Markdown. The workflow writes links to the uploaded artifact into the PR body. For inline images/videos directly visible in the body, the media needs a stable URL, such as GitHub Pages, object storage, or a file committed to the PR branch. The current setup avoids committing generated binary evidence to the repository.
