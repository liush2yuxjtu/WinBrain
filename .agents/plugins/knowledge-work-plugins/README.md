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

This directory currently contains a registry/index of the upstream plugin set, not a byte-for-byte recursive vendor copy of every upstream file. The current GitHub connector exposes file read/write operations but not a recursive repository-directory copy operation.

## Intended target layout

```text
.agents/
├── plugins/
│   └── knowledge-work-plugins/
│       ├── README.md
│       └── plugin-registry.json
└── skills/
    └── knowledge-work-plugins/
        └── README.md
```

## Upstream plugin directories indexed

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
