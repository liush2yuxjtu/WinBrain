import { appendFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const required = ['GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'PR_NUMBER', 'RUN_ID'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  throw new Error(`缺少必需的环境变量：${missing.join(', ')}`);
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
const evidenceTitle = process.env.EVIDENCE_TITLE || 'Playwright 视觉证据';
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
    throw new Error(`GitHub API ${options.method || 'GET'} ${apiPath} 调用失败：${response.status} ${text}`);
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
    return '未找到已提交的媒体文件。';
  }

  const screenshots = files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file));
  const recordingPreviews = files.filter((file) => /(?:^|\/)(?:recording|video)-preview\.gif$/i.test(file));
  const videos = files.filter((file) => /\.(webm|mp4|mov)$/i.test(file));

  const screenshotMarkdown = screenshots.length
    ? screenshots.slice(0, 8).map((file) => {
      const url = repositoryFileUrl(file, { raw: true });
      return `#### ${file}\n\n![视觉证据：${file}](${url})`;
    }).join('\n\n')
    : '未找到可直接内联展示的截图文件。';

  const previewMarkdown = recordingPreviews.length
    ? recordingPreviews.slice(0, 2).map((file) => {
      const url = repositoryFileUrl(file, { raw: true });
      return `#### ${file}\n\n![录屏预览：${file}](${url})`;
    }).join('\n\n')
    : '本次没有生成可内联展示的 GIF 录屏预览。';

  const videoMarkdown = videos.length
    ? videos.map((file) => {
      const url = repositoryFileUrl(file);
      return `- [打开原始录屏：${file}](${url})`;
    }).join('\n')
    : '未找到已提交的原始录屏文件。';

  const manifest = files.length
    ? files.map((file) => `- [${file}](${repositoryFileUrl(file)})`).join('\n')
    : '- 未找到媒体清单文件。';

  return `### 内联截图\n\n${screenshotMarkdown}\n\n### 内联录屏预览\n\n${previewMarkdown}\n\n### 原始录屏\n\n${videoMarkdown}\n\n<details>\n<summary>已提交媒体清单</summary>\n\n${manifest}\n\n</details>`;
}

function translateStatus(value) {
  const labels = {
    success: '通过',
    passed: '通过',
    failure: '失败',
    failed: '失败',
    cancelled: '已取消',
    skipped: '已跳过',
    unknown: '未知',
  };
  return labels[value] || value;
}

const startMarker = `<!-- ${markerName}:start -->`;
const endMarker = `<!-- ${markerName}:end -->`;
const statusLabel = translateStatus(outcome);
const inlineMedia = renderMediaSection();
const mediaLocation = mediaPath
  ? `已提交媒体路径：\`${mediaPath}\`；媒体提交：\`${mediaRef}\`。`
  : '未提供已提交媒体路径。';

const block = `${startMarker}

## ${evidenceTitle}

| 项目 | 内容 |
| --- | --- |
| 状态 | ${statusLabel} |
| 工作流运行 | [打开运行记录](${runUrl}) |
| Artifact 备份 | [下载备份](${artifactUrl}) |
| 已验证提交 | \`${sha}\` |
| 媒体提交 | \`${mediaRef}\` |
| 生成时间 | ${generatedAt} |

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

const summary = `## ${evidenceTitle}\n\n- 状态：${statusLabel}\n- 工作流运行：${runUrl}\n- Artifact 备份：${artifactUrl}\n- 媒体路径：${mediaPath || '未发布'}\n- 媒体提交：${mediaRef}\n- 已验证提交：${sha}\n`;

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

console.log(`已使用内联 ${evidenceTitle} 更新 PR #${prNumber} 正文。`);
