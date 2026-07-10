# WinBrain Agent 工作规范

## 最高优先级：PR 必须使用中文并附带完整证据

所有自动化 Agent（包括 Codex、Claude Code、GitHub Copilot 及其他代码 Agent）在创建或更新 Pull Request 时，必须遵守以下规则：

- PR 标题必须使用简体中文，技术名词、文件名、命令和代码标识符可保留英文。
- PR 中由 Agent 人工撰写的正文必须使用简体中文，不得使用 `Summary`、`Changes`、`Validation` 等英文标题作为主要结构。
- PR 正文至少包含：`概述`、`问题原因`、`变更内容`、`验证`、`功能截图（PNG，必填）`、`功能录屏（GIF，必填）`、`UAT（必填）`、`UAT 录屏（GIF，必填）`、`风险与回滚`。
- 更新已有英文 PR 时，必须先把标题和人工撰写的正文改为中文，再完成任务。
- 第三方机器人自动生成的评论不受本规则约束，但 Agent 不得主动把中文 PR 改回英文。

推荐标题格式：

```text
修复：确保 Agent 使用中文 PR 并内联完整功能与 UAT 证据
```

## 每个 PR 的强制证据

每个 PR 均必须在正文对应章节中直接内联以下四项，纯文档、后端、配置、依赖或基础设施变更也不例外：

1. **功能截图 PNG**：展示本次变更产生的实际功能、输出或可观察结果。
2. **功能录屏 GIF**：展示主要操作路径以及最终结果。
3. **具体 UAT**：必须写明真实验收人、用户/业务角色、验收场景、验收事项、前置条件、操作步骤、预期结果、实际结果和验收结论。
4. **UAT 录屏 GIF**：完整展示上述验收人针对上述具体事项执行 UAT 的过程和结果。

强制规则：

- UAT 必须具体到真实人员和具体业务事项，不得填写“本人”“开发者”“某人”“某事”“待定”“自动化测试”等泛化内容。
- 功能演示 GIF 与 UAT 录屏 GIF 是两份不同证据，不得用同一份 GIF 重复充当两项证据。
- 必须使用 Markdown 图片语法直接内联展示；Actions Artifact、下载链接、原始 WebM/MP4 或文字说明只能作为补充，不能替代必填 PNG/GIF。
- 证据必须来自本次 PR 的最新提交，不得伪造、复用无关图片或沿用旧提交证据。
- 自动工作流生成的通用概览或自动视觉证据仅作为补充，不能替代 PR 作者填写的功能证据与具体 UAT 证据。

## 浏览器可见变更的验证目标

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

- 所有 PR 都必须提供功能截图 PNG、功能录屏 GIF 和 UAT 录屏 GIF；不存在免除视觉证据的变更类型。
- UI、路由或浏览器可见行为发生变化时，优先使用 Playwright 获取真实应用截图和录屏。
- 纯文档变更应展示渲染后的文档结果；后端、配置或基础设施变更应展示可观察的功能输出、验证流程和结果，不得只截图代码 diff。
- 使用 Markdown 图片语法直接展示证据，例如 `![功能截图 PNG：页面状态](图片地址)`；不得只提供 Actions Artifact、下载链接或文字说明。
- 原始 WebM/MP4 可以作为补充链接，但不能替代内联 GIF 预览。
- GitHub Actions 会把媒体发布到 `pr-evidence/pr-<编号>/.../latest/`，并通过 `scripts/update-pr-evidence.mjs` 更新 PR 正文。Agent 不得删除或破坏 `<!-- *:start -->` / `<!-- *:end -->` evidence 标记。
- Artifact 仅作为备份，不是主要视觉证据。
- 不得伪造截图、复用与本次变更无关的图片，或在验证失败时声称已通过。

Playwright 在 CI 中会保存视频，smoke test 会把截图写入 `artifacts/screenshots/`。`artifacts/`、`test-results/` 和 `playwright-report/` 下的临时文件不要直接提交；由 evidence workflow 发布到专用 `pr-evidence/` 路径。

## 目标地址

如果真实应用有预览地址，在 GitHub 仓库变量或 Codex Cloud 环境中设置 `PLAYWRIGHT_TARGET_URL`。未设置时，Playwright smoke test 会使用 `demo/index.html` 作为回退页面。

## PR 提交流程

1. 完成代码修改和必要测试。
2. 使用中文标题创建 PR，并按 `.github/pull_request_template.md` 用中文填写全部章节。
3. 生成并内联功能截图 PNG 与功能录屏 GIF。
4. 由具体人员针对具体业务事项执行 UAT，填写所有 UAT 字段，并内联单独的 UAT 录屏 GIF。
5. 对可视化变更运行 Playwright，检查自动 evidence 区块是否显示最新提交、运行状态和补充媒体；失败时用中文说明原因并修复，不得只留下 Artifact 链接。
6. 确认 `PR 必填证据校验 / 校验功能证据与 UAT` 检查通过。
7. 最终确认 PR 标题、人工正文和自动 evidence 标题均以中文呈现，且四项必填证据均对应最新提交。
