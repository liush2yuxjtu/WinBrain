# Inline Playwright Evidence Demo

This file exists to create a small demonstration PR for the inline Playwright evidence flow.

Expected behavior after CI runs:

1. Playwright records screenshots and videos.
2. Workflow commits generated media under `pr-evidence/` on this PR branch.
3. `scripts/update-pr-evidence.mjs` updates the PR body with inline screenshot and video references.
4. Artifact links remain available only as backup.

This demo PR can be closed after verifying that the PR body renders the media as intended.
