# WinBrain Agent 工作规范

## 最高优先级：PR 必须使用中文

所有自动化 Agent（包括 Codex、Claude Code、GitHub Copilot 及其他代码 Agent）在创建或更新 Pull Request 时，必须遵守以下规则：

- PR 标题必须使用简体中文，技术名词、文件名、命令和代码标识符可保留英文。
- PR 中由 Agent 人工撰写的正文必须使用简体中文，不得使用 `Summary`、`Changes`、`Validation` 等英文标题作为主要结构。
- PR 正文至少包含：`概述`、`问题原因`、`变更内容`、`验证`、`视觉证据`、`风险与回滚`。
- 更新已有英文 PR 时，必须先把标题和人工撰写的正文改为中文，再完成任务。
- 第三方机器人自动生成的评论不受本规则约束，但 Agent 不得主动把中文 PR 改回英文。

推荐标题格式：

```text
修复：确保 Agent 使用中文 PR 并内联视觉证据
```

## 目标

修改 UI、路由或任何浏览器可见行为时，必须使用 Playwright 验证，并在 PR 正文中提供可直接查看的视觉证据。

## 环境准备

使用仓库脚本：

```bash
npm install
npx playwright install --with-deps chromium
```

如果存在 lockfile，优先使用 `npm ci`，不要使用 `npm install`。

## 验证命令

创建或更新 PR 前运行：

```bash
npm run test:e2e
```

本地调试可使用：

```bash
npm run test:e2e:headed
npm run test:e2e:report
```

## 视觉证据要求

- UI、路由或浏览器可见行为发生变化时，PR 正文必须直接内联截图；存在录屏时，还必须内联 GIF 预览。
- 使用 Markdown 图片语法直接展示证据，例如 `![页面验证截图](图片地址)`；不得只提供 Actions artifact、下载链接或文字说明。
- 原始 WebM/MP4 可以作为补充链接，但不能替代内联截图或 GIF 预览。
- GitHub Actions 会把媒体发布到 `pr-evidence/pr-<编号>/.../latest/`，并通过 `scripts/update-pr-evidence.mjs` 更新 PR 正文。Agent 不得删除或破坏 `<!-- *:start -->` / `<!-- *:end -->` evidence 标记。
- Artifact 仅作为备份，不是主要视觉证据。
- 不得伪造截图、复用与本次变更无关的图片，或在验证失败时声称已通过。
- 纯文档、后端或配置变更如果确实没有用户可见影响，应在 `视觉证据` 中明确写明：`本次变更不涉及用户可见界面，无需产品截图。`

Playwright 在 CI 中会保存视频，smoke test 会把截图写入 `artifacts/screenshots/`。`artifacts/`、`test-results/` 和 `playwright-report/` 下的临时文件不要直接提交；由 evidence workflow 发布到专用 `pr-evidence/` 路径。

## 目标地址

如果真实应用有预览地址，在 GitHub 仓库变量或 Codex Cloud 环境中设置 `PLAYWRIGHT_TARGET_URL`。未设置时，Playwright smoke test 会使用 `demo/index.html` 作为回退页面。

## PR 提交流程

1. 完成代码修改和必要测试。
2. 使用中文标题创建 PR，并按 `.github/pull_request_template.md` 用中文填写正文。
3. 对可视化变更运行 Playwright，确保截图或 GIF 由 workflow 直接内联到 PR 正文。
4. 检查自动 evidence 区块是否显示最新提交、运行状态和媒体；失败时用中文说明原因并修复，不得只留下 artifact 链接。
5. 最终确认 PR 标题、人工正文和自动 evidence 标题均以中文呈现。
