# UIUXPROMAX UAT recording

- Target: http://127.0.0.1:3000
- Desktop viewport: 1440x900
- Mobile interaction viewport: 390x844
- Narrow mobile viewport: 320x720
- Result: PASS
- Passed: 6/6
- Failed: 0

| UAT | Acceptance criterion | Status | Observed evidence |
| --- | --- | --- | --- |
| UIUX-UAT-01 | Desktop command workspace keeps navigation, canvas, and copilot visible | PASS | sidebar=244px, canvas=788px, assistant=408px |
| UIUX-UAT-02 | Keyboard focus indicator uses the accessible solid brand color | PASS | A ＋新建 Skill; 3px rgb(15, 118, 110) |
| UIUX-UAT-03 | Small breadcrumb text uses the WCAG-reviewed dark neutral | PASS | breadcrumb color=rgb(82, 101, 111) |
| UIUX-UAT-04 | Mobile navigation opens, closes with Escape, and restores focus | PASS | Escape closes navigation and returns keyboard focus to the menu button |
| UIUX-UAT-05 | Mobile form controls use 16px text to prevent iOS auto-zoom | PASS | expert role input font-size=16px |
| UIUX-UAT-06 | Narrow mobile layout stacks without horizontal overflow | PASS | viewport=320px, scrollWidth=320px, assistant=320px |

## Media

- Desktop video: desktop/video.webm
- Mobile video: mobile/video.webm
- Screenshots: desktop/*.png and mobile/*.png
