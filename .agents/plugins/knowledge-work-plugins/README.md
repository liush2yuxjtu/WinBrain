# Knowledge Work Plugins

Source repository: `anthropics/knowledge-work-plugins`

This directory is the project-level plugin area for Knowledge Work Plugins in this repository.

The upstream repository is a Claude Code / Claude Cowork plugin marketplace. The visible plugin set has been indexed in:

```text
.agents/plugins/knowledge-work-plugins/plugin-registry.json
```

The matching project-level skill index is in:

```text
.agents/skills/knowledge-work-plugins/README.md
```

## Current status

This directory contains a vendored copy of the upstream repository under:

```text
.agents/plugins/knowledge-work-plugins/upstream/
```

The upstream plugin `skills/` trees are also mirrored under:

```text
.agents/skills/knowledge-work-plugins/upstream/
```

`plugin-registry.json` remains a compact index of the upstream plugin families and target paths.

## Upstream plugin directories vendored

- bio-research
- cowork-plugin-management
- customer-support
- data
- design
- engineering
- enterprise-search
- finance
- human-resources
- legal
- marketing
- operations
- partner-built
- pdf-viewer
- product-management
- productivity
- sales
- small-business
