# ECC Hooks 逐文件安全审查

- 仓库：`liush2yuxjtu/WinBrain`
- 被审查提交：`9f0b12fcf375041776d83077bf5c214bd3f97701`
- ECC 上游提交：`40927950c49f6e742d341e20ff7b9b7e1e7bfff5`
- GitHub Actions 运行：[29136431762](https://github.com/liush2yuxjtu/WinBrain/actions/runs/29136431762)
- 审查结论：**FAILURE**

## 核心结论

- 共发现 `4` 个 hooks 目录文件和 `29` 个 hook action。
- `hooks.json` 引用了 `28` 个运行时脚本。
- **高优先级问题：其中 `28` 个脚本未包含在 `.codex/ecc/upstream/` 中；当前 hooks 快照不能独立执行，也无法完成脚本实现层面的逐文件安全审查。**

## Hooks 目录逐文件清单

| 文件 | 字节数 | 可执行位 | SHA-256 |
|---|---:|:---:|---|
| `.codex/ecc/upstream/hooks/README.md` | 10403 | 否 | `1d4a1a34252b1eff11cb20b7cb452657933a2d55d93e00cdebb907916a17982e` |
| `.codex/ecc/upstream/hooks/hooks.json` | 47745 | 否 | `a00e4c71051b067f0ee12613b3f575a06517b857808a22ffb7be4f981f0d82c4` |
| `.codex/ecc/upstream/hooks/memory-persistence/README.md` | 2259 | 否 | `020dc83bf19a4d0a887ee0683c087ebf14fc77f01d178e271277d6912a31bdf5` |
| `.codex/ecc/upstream/hooks/memory-persistence/hooks.json` | 1574 | 否 | `f5361a21a63fc9258920c4ab9fe9d57adcb52e9d6bdd22e7a94eb9349be86c7a` |

## hooks.json 全部 action 审查

| 事件 | Hook ID | Matcher | 异步 | 超时 | 引用脚本数 | 风险特征 |
|---|---|---|:---:|---:|---:|---|
| PreToolUse | `pre:bash:dispatcher` | `Bash` | 否 | — | 2 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PreToolUse | `pre:write:doc-file-warning` | `Write` | 否 | — | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PreToolUse | `pre:edit-write:suggest-compact` | `Edit\|Write` | 否 | — | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PreToolUse | `pre:observe:continuous-learning` | `*` | 是 | 10 | 3 | 读取环境变量、读取用户目录/Claude 配置、后台异步执行、动态加载/执行 Node.js |
| PreToolUse | `pre:governance-capture` | `Bash\|Write\|Edit\|MultiEdit` | 否 | 10 | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PreToolUse | `pre:config-protection` | `Write\|Edit\|MultiEdit` | 否 | 5 | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PreToolUse | `pre:mcp-health-check` | `*` | 否 | — | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PreToolUse | `pre:edit-write:gateguard-fact-force` | `Edit\|Write\|MultiEdit` | 否 | 5 | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PreCompact | `pre:compact` | `*` | 否 | — | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| SessionStart | `session:start` | `*` | 否 | — | 2 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| SessionStart | `session-start:plan-canvas-sessions` | `*` | 否 | — | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PostToolUse | `post:bash:dispatcher` | `Bash` | 是 | 30 | 2 | 读取环境变量、读取用户目录/Claude 配置、后台异步执行、动态加载/执行 Node.js |
| PostToolUse | `post:quality-gate` | `Edit\|Write\|MultiEdit` | 是 | 30 | 3 | 读取环境变量、读取用户目录/Claude 配置、后台异步执行、动态加载/执行 Node.js |
| PostToolUse | `post:edit:design-quality-check` | `Edit\|Write\|MultiEdit` | 否 | 10 | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PostToolUse | `post:edit:accumulator` | `Edit\|Write\|MultiEdit` | 否 | — | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PostToolUse | `post:edit:console-warn` | `Edit` | 否 | — | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PostToolUse | `post:governance-capture` | `Bash\|Write\|Edit\|MultiEdit` | 否 | 10 | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PostToolUse | `post:session-activity-tracker` | `*` | 否 | 10 | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PostToolUse | `post:observe:continuous-learning` | `*` | 是 | 10 | 3 | 读取环境变量、读取用户目录/Claude 配置、后台异步执行、动态加载/执行 Node.js |
| PostToolUse | `post:ecc-metrics-bridge` | `*` | 否 | 10 | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PostToolUse | `post:ecc-context-monitor` | `*` | 否 | 10 | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| PostToolUseFailure | `post:mcp-health-check` | `*` | 否 | — | 3 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| Stop | `stop:format-typecheck` | `*` | 否 | 300 | 1 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| Stop | `stop:check-console-log` | `*` | 否 | — | 1 | 读取环境变量、读取用户目录/Claude 配置、动态加载/执行 Node.js |
| Stop | `stop:session-end` | `*` | 是 | 10 | 1 | 读取环境变量、读取用户目录/Claude 配置、后台异步执行、动态加载/执行 Node.js |
| Stop | `stop:evaluate-session` | `*` | 是 | 10 | 1 | 读取环境变量、读取用户目录/Claude 配置、后台异步执行、动态加载/执行 Node.js |
| Stop | `stop:cost-tracker` | `*` | 是 | 10 | 1 | 读取环境变量、读取用户目录/Claude 配置、后台异步执行、动态加载/执行 Node.js |
| Stop | `stop:desktop-notify` | `*` | 是 | 10 | 1 | 读取环境变量、读取用户目录/Claude 配置、后台异步执行、动态加载/执行 Node.js |
| SessionEnd | `session:end:marker` | `*` | 是 | 10 | 1 | 读取环境变量、读取用户目录/Claude 配置、后台异步执行、动态加载/执行 Node.js |

## 缺失的运行时依赖

- `scripts/hooks/check-console-log.js`
- `scripts/hooks/config-protection.js`
- `scripts/hooks/cost-tracker.js`
- `scripts/hooks/design-quality-check.js`
- `scripts/hooks/desktop-notify.js`
- `scripts/hooks/doc-file-warning.js`
- `scripts/hooks/ecc-context-monitor.js`
- `scripts/hooks/ecc-metrics-bridge.js`
- `scripts/hooks/evaluate-session.js`
- `scripts/hooks/gateguard-fact-force.js`
- `scripts/hooks/governance-capture.js`
- `scripts/hooks/mcp-health-check.js`
- `scripts/hooks/observe-runner.js`
- `scripts/hooks/plan-canvas-sessions.js`
- `scripts/hooks/plugin-hook-bootstrap.js`
- `scripts/hooks/post-bash-dispatcher.js`
- `scripts/hooks/post-edit-accumulator.js`
- `scripts/hooks/post-edit-console-warn.js`
- `scripts/hooks/pre-bash-dispatcher.js`
- `scripts/hooks/pre-compact.js`
- `scripts/hooks/quality-gate.js`
- `scripts/hooks/run-with-flags.js`
- `scripts/hooks/session-activity-tracker.js`
- `scripts/hooks/session-end-marker.js`
- `scripts/hooks/session-end.js`
- `scripts/hooks/session-start-bootstrap.js`
- `scripts/hooks/stop-format-typecheck.js`
- `scripts/hooks/suggest-compact.js`

## 风险解释与处理要求

1. `hooks.json` 中的 action 会动态执行 Node.js，并读取环境变量、用户主目录及 Claude 配置路径。
2. 部分 action 为异步后台任务；启用前应确认其输出目录、保留策略和进程退出行为。
3. 当前 vendored 范围没有包含 `scripts/`。因此本报告只能审查 hook 图与包装命令，不能证明实际脚本无网络访问、无数据外传或无破坏性文件操作。
4. 在补齐并审查运行时脚本以前，不应直接启用 `.codex/ecc/upstream/hooks/hooks.json`。
