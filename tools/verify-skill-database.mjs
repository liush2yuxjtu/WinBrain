import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const email = process.env.FRONTEND_RECORD_EMAIL;
const password = process.env.FRONTEND_RECORD_PASSWORD;
const artifactDir = resolve('artifacts/frontend-recording/snapshots');
const screenshotPath = resolve(artifactDir, '04-after-database-save.png');

if (!email || !password) {
  throw new Error('FRONTEND_RECORD_EMAIL and FRONTEND_RECORD_PASSWORD are required.');
}

await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(frontendUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  const loginEmail = page.locator('input[name="email"]');
  if (await loginEmail.isVisible().catch(() => false)) {
    await loginEmail.fill(email);
    await page.locator('input[name="password"]').fill(password);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }),
      page.getByRole('button', { name: '登录' }).click()
    ]);
  }

  await page.getByText('WinBrain Business Skill Studio').first().waitFor({ state: 'visible', timeout: 30_000 });

  const uniqueMarker = `ci-postgres-${Date.now()}`;
  const markdown = `---\nname: ${uniqueMarker}\ndescription: CI persistence verification skill\n---\n\n# ${uniqueMarker}\n\nThis Skill was saved through the authenticated UI and must be readable from PostgreSQL.`;

  await page.getByLabel('Skill 草稿编辑器').fill(markdown);
  const saveResponsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/skills' && response.request().method() === 'POST',
    { timeout: 60_000 }
  );
  await page.getByRole('button', { name: '保存到 Skill Store' }).click();
  const saveResponse = await saveResponsePromise;
  const savePayload = await saveResponse.json();

  if (saveResponse.status() !== 201 || !savePayload?.skill?.id) {
    throw new Error(`Skill save did not return persisted metadata: ${JSON.stringify(savePayload)}`);
  }

  await page.getByText(/已保存：/).waitFor({ state: 'visible', timeout: 30_000 });

  const listResponse = await page.request.get(`${frontendUrl}/api/skills`);
  const listPayload = await listResponse.json();
  if (!listResponse.ok()) {
    throw new Error(`Skill list failed with ${listResponse.status()}: ${JSON.stringify(listPayload)}`);
  }

  const persisted = Array.isArray(listPayload?.skills)
    && listPayload.skills.some((skill) => skill.id === savePayload.skill.id && skill.name === savePayload.skill.name);
  if (!persisted) {
    throw new Error(`Saved Skill ${savePayload.skill.id} was not readable from the configured database.`);
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(JSON.stringify({
    databasePersistence: 'passed',
    skillId: savePayload.skill.id,
    skillName: savePayload.skill.name,
    version: savePayload.skill.version,
    screenshotPath
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
