# Vendored Anthropic Claude Plugins Official

Source repository: <https://github.com/anthropics/claude-plugins-official>

Vendored from upstream commit: `c78da81119b6295856638784432e4f85902123d6`
(`c78da81`, 2026-07-09 — *bump(databricks): 4f10b138 → f68da29d (#3879)*)

## Layout

The upstream `/plugins/` tree (37 bundled plugins, 325 files) is copied under:

```text
.agents/plugins/claude-plugins-official/upstream/plugins/
```

Skill subtrees are mirrored under:

```text
.agents/skills/claude-plugins-official/upstream/<plugin>/skills/
```

Nested skill `references/` directories preserve their upstream relative paths.

Per-plugin counts of skills / agents / commands / hooks, plus the upstream pin, are recorded in `plugin-registry.json` next to this file.

## Safety note

The vendored tree includes 22 third-party executable hooks under `*/hooks/*` (Python and shell). These are vendored as unvetted code. Reviewers and agents should treat them as third-party scripts requiring individual audit before being installed or executed; the per-plugin hook count is recorded in `plugin-registry.json`.

The bundled `/plugins/` tree is vendored. External partner/community plugins under `/external_plugins/` are not vendored here.
