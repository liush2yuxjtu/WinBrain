import { appendFileSync } from 'node:fs';

const required = ['GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'PR_NUMBER', 'RUN_ID'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
}

const token = process.env.GITHUB_TOKEN;
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const prNumber = process.env.PR_NUMBER;
const runId = process.env.RUN_ID;
const runUrl = process.env.RUN_URL || `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
const artifactUrl = process.env.ARTIFACT_URL || `${runUrl}#artifacts`;
const outcome = process.env.TEST_OUTCOME || 'unknown';
const sha = process.env.GITHUB_SHA || 'unknown';
const generatedAt = new Date().toISOString();

const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function github(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

const startMarker = '<!-- playwright-evidence:start -->';
const endMarker = '<!-- playwright-evidence:end -->';

const statusLabel = outcome === 'success' ? 'passed' : outcome === 'failure' ? 'failed' : outcome;
const block = `${startMarker}

## Playwright evidence

| Field | Value |
| --- | --- |
| Status | ${statusLabel} |
| Workflow run | [Open run](${runUrl}) |
| Screenshots/videos/report artifact | [Download artifact](${artifactUrl}) |
| Commit | \`${sha}\` |
| Generated | ${generatedAt} |

The artifact contains Playwright HTML report files, screenshots from \`artifacts/screenshots/\`, videos and traces from \`test-results/\`.

${endMarker}`;

const pr = await github(`/pulls/${prNumber}`);
const currentBody = pr.body || '';
const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
const nextBody = pattern.test(currentBody)
  ? currentBody.replace(pattern, block)
  : `${currentBody.trim()}${currentBody.trim() ? '\n\n' : ''}${block}`;

await github(`/pulls/${prNumber}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ body: nextBody }),
});

const summary = `## Playwright evidence\n\n- Status: ${statusLabel}\n- Workflow run: ${runUrl}\n- Artifact: ${artifactUrl}\n- Commit: ${sha}\n`;

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

console.log(`Updated PR #${prNumber} with Playwright evidence.`);
