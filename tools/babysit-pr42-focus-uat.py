#!/usr/bin/env python3
"""Make the UIUX keyboard focus UAT deterministic without using coordinates."""

from pathlib import Path

file = Path("tools/record-uiux-promax-uat.mjs")
text = file.read_text(encoding="utf-8")
old = """      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
      })
      await page.keyboard.press('Tab')
      const focused = page.locator(':focus')"""
new = """      const focusTarget = page.locator('.sidebar-create')
      await focusTarget.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      const focused = page.locator(':focus')
      assert(await focused.evaluate((element) => element.classList.contains('sidebar-create')), 'Keyboard focus did not return to the new Skill link')"""
if old not in text:
    if new not in text:
        raise SystemExit("focus UAT marker not found")
else:
    file.write_text(text.replace(old, new, 1), encoding="utf-8")
