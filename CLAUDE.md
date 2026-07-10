# Claude Code 仓库规则

在本仓库执行任务时，必须完整遵守根目录 [`AGENTS.md`](./AGENTS.md)。

创建或更新 Pull Request 时尤其需要遵守：

- PR 标题和人工撰写的正文必须使用简体中文。
- 正文必须包含中文的概述、问题原因、变更内容、验证、视觉证据、风险与回滚。
- UI、路由或浏览器可见行为发生变化时，必须运行 Playwright，并在 PR 正文直接内联截图；有录屏时同时内联 GIF 预览。
- 不得只提供 Actions artifact 或原始视频链接作为视觉证据。
- 不得删除 evidence workflow 写入的标记区块。
