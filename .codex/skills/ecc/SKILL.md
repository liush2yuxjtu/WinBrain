---
name: ecc
description: Install and use the Everything Claude Code (ECC) agent harness assets in this project. Use for ECC hooks, skills, plugins, commands, and agents, and for refreshing the vendored ECC snapshot.
---

# ECC project skill

This project integrates selected assets from `affaan-m/ECC` for OpenAI Codex.

## Installed scope

Only these upstream directories are selected:

- `hooks/`
- `skills/`
- `plugins/`
- `commands/`
- `agents/`

The synchronized snapshot belongs under `.codex/ecc/upstream/`. Do not copy unrelated ECC configuration into the project root.

## Refresh or install

Run:

```bash
bash .codex/ecc/install-ecc.sh
```

The installer performs a sparse checkout of the upstream `main` branch and atomically replaces the selected snapshot. It records the source commit in `.codex/ecc/ECC_COMMIT`.

## Codex usage

1. Prefer native project instructions and existing project skills when they conflict with upstream ECC guidance.
2. Read the relevant file under `.codex/ecc/upstream/skills/` before applying an ECC workflow.
3. Treat scripts and hooks as executable code: inspect them before enabling or running them.
4. Never copy upstream secrets, machine-local configuration, or MCP credentials into the repository.
5. Keep modifications to vendored files separate from project-specific wrappers; refreshes replace the upstream snapshot.

## Source

Upstream: `https://github.com/affaan-m/ECC`, branch `main`.
