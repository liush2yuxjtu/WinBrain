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
- /home/runner/work/WinBrain/WinBrain/artifacts/frontend-recording/snapshots/01-business-skill-studio-home.png

## Console output

No console messages captured.

## Failure

```text
Error: Chat API did not use Claude Agent SDK: ["All Claude Agent SDK credentials failed: primary: Claude Agent SDK returned success | fallback: Claude Agent SDK returned success"]
    at readApiPayload (file:///home/runner/work/WinBrain/WinBrain/.github/.trusted/record-frontend.mjs:161:11)
    at async recordBusinessSkillStudioScenario (file:///home/runner/work/WinBrain/WinBrain/.github/.trusted/record-frontend.mjs:214:3)
    at async file:///home/runner/work/WinBrain/WinBrain/.github/.trusted/record-frontend.mjs:279:3
```
