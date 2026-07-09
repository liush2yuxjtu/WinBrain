# Vendored Knowledge Work Plugins

Source repository: https://github.com/anthropics/knowledge-work-plugins

Vendored from upstream commit: `f96c57c`

Re-sync log:

- 2026-07-09: re-cloned `https://github.com/anthropics/knowledge-work-plugins` into `/tmp/knowledge-work-plugins`; HEAD verified at `f96c57c`; `diff -rq` against `.agents/plugins/knowledge-work-plugins/upstream/` is empty (only `.git/` excluded). No upstream changes since the initial vendor; mirror is byte-identical.

The full upstream repository is copied under:

```text
.agents/plugins/knowledge-work-plugins/upstream/
```

Plugin skill directories are also mirrored under:

```text
.agents/skills/knowledge-work-plugins/upstream/
```

Nested plugin skill directories (for example `partner-built/*/skills`) preserve their upstream relative paths.
