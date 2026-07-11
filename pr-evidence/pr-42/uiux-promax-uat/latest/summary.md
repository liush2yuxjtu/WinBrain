# UIUXPROMAX UAT recording

- Target: http://127.0.0.1:3000
- Desktop viewport: 1440x900
- Mobile interaction viewport: 390x844
- Narrow mobile viewport: 320x720
- Result: FAIL
- Passed: 1/6
- Failed: 1

| UAT | Acceptance criterion | Status | Observed evidence |
| --- | --- | --- | --- |
| UIUX-UAT-01 | Desktop command workspace keeps navigation, canvas, and copilot visible | PASS | sidebar=244px, canvas=788px, assistant=408px |
| UIUX-UAT-02 | Keyboard focus indicator uses the accessible solid brand color | FAIL | Unexpected focus color: rgb(139, 144, 152) |

## Media

- Desktop video: desktop/video.webm
- Mobile video: mobile/video.webm
- Screenshots: desktop/*.png and mobile/*.png

## Failure

```text
Error: Unexpected focus color: rgb(139, 144, 152)
    at assert (file:///home/runner/work/WinBrain/WinBrain/tools/record-uiux-promax-uat.mjs:19:25)
    at file:///home/runner/work/WinBrain/WinBrain/tools/record-uiux-promax-uat.mjs:127:7
    at async verify (file:///home/runner/work/WinBrain/WinBrain/tools/record-uiux-promax-uat.mjs:24:20)
    at async recordDesktop (file:///home/runner/work/WinBrain/WinBrain/tools/record-uiux-promax-uat.mjs:107:5)
    at async file:///home/runner/work/WinBrain/WinBrain/tools/record-uiux-promax-uat.mjs:242:3
```
