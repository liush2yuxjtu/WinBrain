import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const NAVIGATION_TIMEOUT_MS = 60_000;
const UI_TIMEOUT_MS = 30_000;
const SAVE_RESPONSE_TIMEOUT_MS = 60_000;
const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const databaseUrl = process.env.DATABASE_URL;
const email = process.env.FRONTEND_RECORD_EMAIL;
const password = process.env.FRONTEND_RECORD_PASSWORD;
const artifactDir = resolve('artifacts/frontend-recording/snapshots');
const screenshotPath = resolve(artifactDir, '04-after-database-save.png');
const appRequire = createRequire(new URL('../apps/business-skill-studio/package.json', import.meta.url));
const { Client } = appRequire('pg');

if (!email || !password) {
  throw new Error('FRONTEND_RECORD_EMAIL and FRONTEND_RECORD_PASSWORD are required.');
}
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for PostgreSQL persistence verification.');
}

await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const database = new Client({ connectionString: databaseUrl });

try {
  await page.goto(frontendUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });

  const loginEmail = page.getByLabel('邮箱');
  if (await loginEmail.isVisible().catch(() => false)) {
    await loginEmail.fill(email);
    await page.getByLabel('密码').fill(password);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: UI_TIMEOUT_MS }),
      page.getByRole('button', { name: '登录' }).click()
    ]);
  }

  await page.getByRole('heading', { name: 'WinBrain Business Skill Studio' }).waitFor({ state: 'visible', timeout: UI_TIMEOUT_MS });

  const uniqueMarker = `ci-postgres-${Date.now()}`;
  const markdown = `---\nname: ${uniqueMarker}\ndescription: CI persistence verification skill\n---\n\n# ${uniqueMarker}\n\nThis Skill was saved through the authenticated UI and must be readable from PostgreSQL.`;

  await page.getByLabel('Skill 草稿编辑器').fill(markdown);
  const saveResponsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/skills' && response.request().method() === 'POST',
    { timeout: SAVE_RESPONSE_TIMEOUT_MS }
  );
  await page.getByRole('button', { name: '保存到 Skill Store' }).click();
  const saveResponse = await saveResponsePromise;
  const savePayload = await saveResponse.json();

  if (saveResponse.status() !== 201 || !savePayload?.skill?.id) {
    throw new Error(`Skill save did not return persisted metadata: ${JSON.stringify(savePayload)}`);
  }

  await page.getByText(/已保存：/).waitFor({ state: 'visible', timeout: UI_TIMEOUT_MS });

  await database.connect();
  const persistedResult = await database.query(
    `SELECT s.id, s.name, s.slug, r.version, r.skill_markdown
       FROM skills AS s
       JOIN LATERAL (
         SELECT version, skill_markdown
           FROM skill_revisions
          WHERE skill_id = s.id
          ORDER BY version DESC
          LIMIT 1
       ) AS r ON TRUE
      WHERE s.id = $1`,
    [savePayload.skill.id]
  );
  const persisted = persistedResult.rows[0];

  if (!persisted
      || persisted.id !== savePayload.skill.id
      || persisted.name !== savePayload.skill.name
      || Number(persisted.version) !== Number(savePayload.skill.version)
      || !String(persisted.skill_markdown).includes(uniqueMarker)) {
    throw new Error(`PostgreSQL readback did not match the UI save response: ${JSON.stringify({ saved: savePayload.skill, persisted })}`);
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(JSON.stringify({
    databasePersistence: 'passed',
    skillId: persisted.id,
    skillName: persisted.name,
    version: Number(persisted.version),
    screenshotPath
  }, null, 2));
} finally {
  await database.end().catch(() => undefined);
  await context.close();
  await browser.close();
}
