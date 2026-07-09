# WinBrain agent instructions

## Goal

When you change UI, routing, or browser-visible behavior, validate the change with Playwright and leave enough evidence for review.

## Setup

Use the repository scripts:

```bash
npm install
npx playwright install --with-deps chromium
```

If a lockfile exists, prefer `npm ci` instead of `npm install`.

## Validation commands

Run this before opening or updating a PR:

```bash
npm run test:e2e
```

For local debugging, use:

```bash
npm run test:e2e:headed
npm run test:e2e:report
```

## Screenshot and video evidence

- Playwright is configured to save videos in CI.
- The smoke test writes a screenshot to `artifacts/screenshots/`.
- Generated files under `artifacts/`, `test-results/`, and `playwright-report/` are evidence artifacts. Do not commit them unless explicitly requested.
- GitHub Actions uploads those files as a workflow artifact and updates the PR body with the artifact link.

## Target URL

If the real app has a preview URL, set `PLAYWRIGHT_TARGET_URL` in the GitHub repository variables or in the Codex Cloud environment. Without it, the Playwright smoke test captures `demo/index.html` as a fallback page.

## PR guidance

When using Codex Cloud to create a PR, mention that Playwright should be run and that the GitHub Actions workflow will attach the screenshot/video artifact to the PR body after the PR is opened.
