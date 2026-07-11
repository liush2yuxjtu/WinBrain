# UIUXPROMAX recording UAT

This UAT is the release evidence for the UIUXPROMAX redesign of Business Skill Studio. It is intentionally separate from the generic frontend recording and live-model recording workflows: those prove that the application opens and that Kimi can answer, while this workflow proves the specific responsive and accessibility behavior introduced by the redesign.

## Automated acceptance cases

| ID | Persona and task | Acceptance criterion | Recorded evidence |
| --- | --- | --- | --- |
| `UIUX-UAT-01` | Desktop operations user opens the Skill workbench | At 1440×900, the primary navigation, workbench canvas, and persistent copilot are visible together and retain usable widths | `desktop/01-command-workspace.png`, `desktop/video.webm` |
| `UIUX-UAT-02` | Keyboard-only user enters the workspace | Tabbing to the first interactive control shows a solid 3px `#0f766e` focus indicator | `desktop/02-keyboard-focus.png`, `desktop/video.webm` |
| `UIUX-UAT-03` | Low-vision reviewer reads the breadcrumb | Breadcrumb text resolves to the reviewed dark neutral `#52656f`, rather than the previous low-contrast gray | `desktop/video.webm`, `uat-results.json` |
| `UIUX-UAT-04` | Mobile keyboard user opens and dismisses navigation | At 390×844, the navigation opens, Escape closes it, and focus returns to the menu button | `mobile/01-mobile-navigation-open.png`, `mobile/video.webm` |
| `UIUX-UAT-05` | iPhone user edits expert context | Form controls resolve to `16px` at widths up to 560px, preventing browser auto-zoom | `mobile/02-mobile-form-focus.png`, `mobile/video.webm` |
| `UIUX-UAT-06` | Narrow-screen user reviews the complete workspace | At 320×720, the workbench stacks vertically, the assistant uses the viewport width, and the document has no horizontal overflow | `mobile/03-narrow-320-layout.png`, `mobile/video.webm`, `uat-results.json` |

## Workflow

`.github/workflows/uiux-promax-uat-recording.yml`:

1. installs the root Playwright dependencies and Business Skill Studio dependencies;
2. creates deterministic, CI-only authentication;
3. builds and starts the production Next.js application;
4. runs `tools/record-uiux-promax-uat.mjs` against a 1440×900 desktop, a 390×844 mobile interaction viewport, and a 320×720 narrow viewport;
5. converts the desktop and mobile WebM recordings into inline GIF previews;
6. uploads the complete evidence bundle as an Actions artifact;
7. commits the evidence under `pr-evidence/pr-<number>/uiux-promax-uat/latest`;
8. updates the PR body using the `uiux-promax-uat-recording` evidence marker.

The workflow does not need a live Kimi key because these criteria test visual structure, keyboard interaction, responsive behavior, and computed CSS contracts rather than model quality.

## Pass conditions

The job passes only when all six UAT cases pass and both viewport recordings exist. A failure still uploads screenshots, browser console output, `summary.md`, and `uat-results.json` for diagnosis.
