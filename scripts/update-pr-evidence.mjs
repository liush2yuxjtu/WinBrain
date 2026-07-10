import { appendFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

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
const evidenceTitle = process.env.EVIDENCE_TITLE || 'Playwright evidence';
const markerName = process.env.EVIDENCE_MARKER || 'playwright-evidence';
const mediaPath = process.env.EVIDENCE_MEDIA_PATH || '';
const mediaRef = process.env.EVIDENCE_MEDIA_REF || sha;

const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function github(apiPath, options = {}) {
  const response = await fetch(`${apiBase}${apiPath}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${options.method || 'GET'} ${apiPath} failed: ${response.status} ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function safeStat(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function walkFiles(directory, prefix = '') {
  if (!existsSync(directory) || !safeStat(directory)?.isDirectory()) return [];

  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const absolute = path.join(directory, entry);
    const relative = prefix ? `${prefix}/${entry}` : entry;
    const stats = safeStat(absolute);

    if (!stats) return [];
    if (stats.isDirectory()) return walkFiles(absolute, relative);
    if (stats.isFile()) return [relative];
    return [];
  });
}

function encodedPathSegments(filePath) {
  return filePath.replace(/\\/g, '/').split('/').filter(Boolean).map(encodeURIComponent);
}

function repositoryFileUrl(relativePath, { raw = false } = {}) {
  const encodedPath = [
    ...encodedPathSegments(mediaPath),
    ...encodedPathSegments(relativePath),
  ].join('/');
  const url = `https://github.com/${owner}/${repo}/blob/${mediaRef}/${encodedPath}`;
  return raw ? `${url}?raw=1` : url;
}

function renderMediaSection() {
  const files = mediaPath ? walkFiles(mediaPath).sort() : [];
  if (files.length === 0) {
    return 'No committed media files were found.';
  }

  const screenshots = files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file));
  const recordingPreviews = files.filter((file) => /(?:^|\/)(?:recording|video)-preview\.gif$/i.test(file));
  const videos = files.filter((file) => /\.(webm|mp4|mov)$/i.test(file));

  const screenshotMarkdown = screenshots.length
    ? screenshots.slice(0, 8).map((file) => {
      const url = repositoryFileUrl(file, { raw: true });
      return `#### ${file}\n\n![${file}](${url})`;
    }).join('\n\n')
    : 'No committed screenshot files were found for inline rendering.';

  const previewMarkdown = recordingPreviews.length
    ? recordingPreviews.slice(0, 2).map((file) => {
      const url = repositoryFileUrl(file, { raw: true });
      return `#### ${file}\n\n![Animated recording preview for ${file}](${url})`;
    }).join('\n\n')
    : 'No animated recording preview was generated.';

  const videoMarkdown = videos.length
    ? videos.map((file) => {
      const url = repositoryFileUrl(file);
      return `- [Open original recording: ${file}](${url})`;
    }).join('\n')
    : 'No committed video files were found.';

  const manifest = files.length
    ? files.map((file) => `- [${file}](${repositoryFileUrl(file)})`).join('\n')
    : '- No media manifest files found.';

  return `### Inline screenshots\n\n${screenshotMarkdown}\n\n### Inline recording preview\n\n${previewMarkdown}\n\n### Original recordings\n\n${videoMarkdown}\n\n<details>\n<summary>Committed media manifest</summary>\n\n${manifest}\n\n</details>`;
}

const startMarker = `<!-- ${markerName}:start -->`;
const endMarker = `<!-- ${markerName}:end -->`;
const statusLabel = outcome === 'success' ? 'passed' : outcome === 'failure' ? 'failed' : outcome;
const inlineMedia = renderMediaSection();
const mediaLocation = mediaPath
  ? `Committed media path: \`${mediaPath}\` at ref \`${mediaRef}\`.`
  : 'No committed media path was provided.';

const block = `${startMarker}

## ${evidenceTitle}

| Field | Value |
| --- | --- |
| Status | ${statusLabel} |
| Workflow run | [Open run](${runUrl}) |
| Artifact backup | [Download artifact](${artifactUrl}) |
| Commit tested | \`${sha}\` |
| Media ref | \`${mediaRef}\` |
| Generated | ${generatedAt} |

${mediaLocation}

${inlineMedia}

${endMarker}`;

const pr = await github(`/pulls/${prNumber}`);
const currentBody = pr.body || '';
const startIndex = currentBody.indexOf(startMarker);
const endIndex = startIndex === -1
  ? -1
  : currentBody.indexOf(endMarker, startIndex + startMarker.length);
const nextBody = startIndex !== -1 && endIndex !== -1
  ? currentBody.slice(0, startIndex) + block + currentBody.slice(endIndex + endMarker.length)
  : `${currentBody.trim()}${currentBody.trim() ? '\n\n' : ''}${block}`;

await github(`/pulls/${prNumber}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ body: nextBody }),
});

const summary = `## ${evidenceTitle}\n\n- Status: ${statusLabel}\n- Workflow run: ${runUrl}\n- Artifact backup: ${artifactUrl}\n- Media path: ${mediaPath || 'not published'}\n- Media ref: ${mediaRef}\n- Commit: ${sha}\n`;

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

console.log(`Updated PR #${prNumber} body with inline ${evidenceTitle}.`);
