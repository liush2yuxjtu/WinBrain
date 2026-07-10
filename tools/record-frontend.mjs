import { chromium } from 'playwright';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const ARTIFACT_DIR = resolve('artifacts/frontend-recording');
const VIDEO_DIR = resolve(ARTIFACT_DIR, 'video');
const SNAPSHOT_DIR = resolve(ARTIFACT_DIR, 'snapshots');
const SCREENSHOT_PATH = resolve(ARTIFACT_DIR, 'frontend-page.png');
const SUMMARY_PATH = resolve(ARTIFACT_DIR, 'summary.md');
const DIAGNOSTIC_HTML_PATH = resolve(ARTIFACT_DIR, 'diagnostic.html');
const SERVER_LOG_PATH = resolve(ARTIFACT_DIR, 'frontend-server.log');
const configuredApiTimeout = Number(process.env.FRONTEND_API_RESPONSE_TIMEOUT_MS || 180_000);
const API_RESPONSE_TIMEOUT_MS = Number.isFinite(configuredApiTimeout) && configuredApiTimeout > 0
  ? configuredApiTimeout
  : 180_000;

const COMMON_FRONTEND_URLS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:8080',
  'http://localhost:8080'
];

await mkdir(VIDEO_DIR, { recursive: true });
await mkdir(SNAPSHOT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function urlReachable(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow'
    });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForReachable(urls, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const url of urls) {
      if (await urlReachable(url)) return url;
    }
    await sleep(1000);
  }
  return null;
}

async function startFrontendIfRequested() {
  const command = process.env.FRONTEND_START_COMMAND;
  if (!command) return null;

  await mkdir(dirname(SERVER_LOG_PATH), { recursive: true });
  const log = createWriteStream(SERVER_LOG_PATH, { flags: 'a' });
  log.write(`$ ${command}\n\n`);

  const child = spawn(command, {
    shell: true,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: 'true' }
  });

  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on('exit', (code, signal) => {
    log.write(`\n[frontend process exited] code=${code} signal=${signal}\n`);
  });
  return child;
}

async function resolveTargetUrl() {
  if (process.env.FRONTEND_URL) {
    return { url: process.env.FRONTEND_URL, mode: 'explicit FRONTEND_URL' };
  }

  const processHandle = await startFrontendIfRequested();
  const detected = await waitForReachable(COMMON_FRONTEND_URLS, processHandle ? 60_000 : 3_000);
  if (detected) {
    return {
      url: detected,
      mode: processHandle ? 'FRONTEND_START_COMMAND + auto-detected URL' : 'auto-detected existing local URL',
      process: processHandle
    };
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>WinBrain Frontend Diagnostic</title></head><body><main><h1>Frontend not detected</h1><p>Set FRONTEND_URL or FRONTEND_START_COMMAND.</p></main></body></html>`;
  await writeFile(DIAGNOSTIC_HTML_PATH, html, 'utf8');
  return {
    url: pathToFileURL(DIAGNOSTIC_HTML_PATH).href,
    mode: 'diagnostic fallback page',
    process: processHandle
  };
}

async function launchBrowser() {
  const channel = process.env.PLAYWRIGHT_CHANNEL || 'chrome';
  try {
    return await chromium.launch({ channel, headless: true, args: ['--no-sandbox'] });
  } catch (error) {
    console.warn(`Could not launch Chromium channel '${channel}'. Falling back to bundled Chromium.`, error.message);
    return chromium.launch({ headless: true, args: ['--no-sandbox'] });
  }
}

async function stopFrontendProcess(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch {
    child.kill?.('SIGTERM');
  }
}

async function captureSnapshot(page, name) {
  const path = resolve(SNAPSHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

function responseMatchesPath(response, expectedPath) {
  try {
    return new URL(response.url()).pathname === expectedPath;
  } catch {
    return false;
  }
}

async function readApiPayload(response, label) {
  const raw = await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(`${label} returned non-JSON status ${response.status()}: ${raw.slice(0, 500)}`);
  }

  if (!response.ok()) {
    throw new Error(`${label} failed with status ${response.status()}: ${JSON.stringify(payload)}`);
  }

  if (payload?.usedAgentSdk !== true) {
    throw new Error(`${label} did not use Claude Agent SDK: ${JSON.stringify(payload?.warnings || payload)}`);
  }

  if (payload?.provider !== 'claude-agent-sdk') {
    throw new Error(`${label} used unexpected provider: ${JSON.stringify(payload?.provider)}`);
  }

  if (!['primary', 'fallback'].includes(payload?.credentialSlot)) {
    throw new Error(`${label} did not report a valid credential slot: ${JSON.stringify(payload?.credentialSlot)}`);
  }

  return payload;
}

function waitForApiResponse(page, path) {
  return page.waitForResponse(
    (response) => responseMatchesPath(response, path),
    { timeout: API_RESPONSE_TIMEOUT_MS }
  );
}

async function recordBusinessSkillStudioScenario(page, snapshots) {
  if (process.env.FRONTEND_RECORD_SCENARIO !== 'business-skill-studio') return;

  const loginEmail = page.locator('input[name="email"]');
  if (await loginEmail.isVisible().catch(() => false)) {
    const email = process.env.FRONTEND_RECORD_EMAIL;
    const password = process.env.FRONTEND_RECORD_PASSWORD;
    if (!email || !password) throw new Error('Frontend recording login credentials are not configured.');

    await loginEmail.fill(email);
    await page.locator('input[name="password"]').fill(password);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }),
      page.getByRole('button', { name: '登录' }).click()
    ]);
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }

  const title = page.getByText('WinBrain Business Skill Studio').first();
  if (!await title.isVisible().catch(() => false)) {
    throw new Error('Business Skill Studio home was not visible after authentication.');
  }

  snapshots.push(await captureSnapshot(page, '01-business-skill-studio-home'));

  const messageBox = page.getByPlaceholder('描述流程、例外、输出要求或给一个真实案例');
  await messageBox.fill('我们每周都要看客户健康度，判断哪些账号需要 CSM 介入。请把这个流程沉淀成可以复用的 skill。');

  const [chatResponse] = await Promise.all([
    waitForApiResponse(page, '/api/chat'),
    page.getByRole('button', { name: '发送给 AI' }).click()
  ]);
  await readApiPayload(chatResponse, 'Chat API');
  snapshots.push(await captureSnapshot(page, '02-after-chat-response'));

  const [draftResponse] = await Promise.all([
    waitForApiResponse(page, '/api/skills/draft'),
    page.getByRole('button', { name: '生成 Skill 草稿' }).click()
  ]);
  await readApiPayload(draftResponse, 'Skill draft API');
  snapshots.push(await captureSnapshot(page, '03-after-skill-draft'));
}

function buildSummary({ target, videoPath, consoleMessages, snapshots, error }) {
  const snapshotOutput = snapshots.length
    ? snapshots.map((path) => `- ${path}`).join('\n')
    : 'No staged snapshots captured.';
  const consoleOutput = consoleMessages.length
    ? consoleMessages.map((line) => `- ${line}`).join('\n')
    : 'No console messages captured.';
  const failure = error
    ? `\n## Failure\n\n\`\`\`text\n${error.stack || error.message || String(error)}\n\`\`\`\n`
    : '';

  return `# Frontend recording summary

- Target: ${target?.url ?? 'not resolved'}
- Resolution: 1440x900
- Target selection mode: ${target?.mode ?? 'not resolved'}
- Required provider: claude-agent-sdk
- Credential failover: primary -> fallback
- API response timeout: ${API_RESPONSE_TIMEOUT_MS}ms
- Final screenshot: ${SCREENSHOT_PATH}
- Video: ${videoPath}

## Staged snapshots

${snapshotOutput}

## Console output

${consoleOutput}
${failure}`;
}

let target;
let browser;
let context;
let videoPath = 'not available';
const consoleMessages = [];
const snapshots = [];

try {
  target = await resolveTargetUrl();
  browser = await launchBrowser();
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } }
  });

  const page = await context.newPage();
  const video = page.video();
  page.on('console', (message) => consoleMessages.push(`[${message.type()}] ${message.text()}`));

  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  snapshots.push(await captureSnapshot(page, '00-page-loaded'));
  await recordBusinessSkillStudioScenario(page, snapshots);
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  await page.waitForTimeout(2_000);

  await context.close();
  context = undefined;
  videoPath = await video.path().catch(() => 'not available');

  const summary = buildSummary({ target, videoPath, consoleMessages, snapshots });
  await writeFile(SUMMARY_PATH, summary, 'utf8');
  console.log(summary);
} catch (error) {
  console.error('Recording failed:', error);
  process.exitCode = 1;
  const summary = buildSummary({ target, videoPath, consoleMessages, snapshots, error });
  await writeFile(SUMMARY_PATH, summary, 'utf8');
} finally {
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  await stopFrontendProcess(target?.process);
}
