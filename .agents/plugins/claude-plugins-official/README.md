# Claude Plugins Official

Source repository: `anthropics/claude-plugins-official`

This directory is the project-level plugin area for the Anthropic official Claude plugin marketplace in this repository.

The upstream repository is a Claude Code plugin marketplace. The vendored bundle covers the bundled `/plugins/` tree (37 plugins); partner/community entries under `/external_plugins/` are not vendored here — see `marketplace-source.json` for details on the marketplace layout.

## Current status

This directory contains a vendored copy of the upstream `/plugins/` tree under:

```text
.agents/plugins/claude-plugins-official/upstream/plugins/
```

The upstream per-plugin `skills/` trees are mirrored under:

```text
.agents/skills/claude-plugins-official/upstream/<plugin>/skills/
```

`plugin-registry.json` is a compact index of the bundled plugins, their target paths, and per-plugin counts of skills / agents / commands / hooks. `VENDORED_FROM.md` records the upstream commit pin (`c78da81119b6295856638784432e4f85902123d6`, 2026-07-09) and explains why the prior registry-only install was superseded.

## Safety note

The vendored tree includes 22 third-party executable hooks under `*/hooks/*` (Python and shell). These are vendored as unvetted code. Reviewers and agents should treat them as third-party scripts requiring individual audit before being installed or executed; the per-plugin hook count is recorded in `plugin-registry.json`.
