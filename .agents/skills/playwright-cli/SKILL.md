# Playwright CLI

Use this skill when the project needs browser automation, frontend smoke tests, screenshots, video recording, or CI-based browser capture.

## Installed project commands

```bash
npm install
npm run playwright:install
npm run record:frontend
npm run test:frontend
```

## Recording a page

The default recorder is:

```bash
npm run record:frontend
```

It writes artifacts under:

```text
artifacts/frontend-recording/
├── frontend-page.png
├── summary.md
└── video/
```

## Target selection

Prefer an explicit target when available:

```bash
FRONTEND_URL=http://127.0.0.1:5173 npm run record:frontend
```

Or provide a startup command:

```bash
FRONTEND_START_COMMAND="npm run dev -- --host 127.0.0.1" npm run record:frontend
```

If no frontend is detected, the recorder captures a diagnostic fallback page rather than failing silently.

## Chrome requirement

The GitHub Actions workflow installs Chrome with:

```bash
npx playwright install --with-deps chrome
```

The recorder launches the Playwright `chrome` channel by default and falls back to bundled Chromium only if Chrome launch fails.

## Safety

Do not record authenticated private user data, credentials, tokens, or content under `user_upload/`. That tree is protected by `user_upload/AGENTS.md` and must not be edited by agents.
