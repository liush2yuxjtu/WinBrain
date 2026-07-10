# Frontend recording summary

- Target: http://127.0.0.1:3000
- Resolution: 1440x900
- Target selection mode: FRONTEND_START_COMMAND + auto-detected URL
- Required provider: claude-agent-sdk
- Credential failover: primary -> fallback
- API response timeout: 1250000ms
- Final screenshot: /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/frontend-page.png
- Video: not available

## Staged snapshots

- /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/snapshots/00-page-loaded.png

## Console output

- [error] Failed to load resource: the server responded with a status of 503 (Service Unavailable)

## Failure

```text
Error: Business Skill Studio home was not visible after authentication.
    at recordBusinessSkillStudioScenario (file:///home/runner/work/WinBrain/WinBrain/.github/.trusted/record-frontend.mjs:202:11)
    at async file:///home/runner/work/WinBrain/WinBrain/.github/.trusted/record-frontend.mjs:279:3
```
