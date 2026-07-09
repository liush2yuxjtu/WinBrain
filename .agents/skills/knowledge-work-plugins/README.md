# Knowledge Work Skills

Source: `anthropics/knowledge-work-plugins`

This project-level skill directory indexes the skills bundled inside Anthropic's Knowledge Work Plugins repository.

Each upstream plugin follows this structure:

```text
plugin-name/
├── .claude-plugin/plugin.json
├── .mcp.json
├── commands/
└── skills/
```

The upstream repository describes plugins as file-based Markdown/JSON bundles containing skills, connectors, commands, and sub-agents. This folder is the project-level landing area for Codex/agent skill discovery and future vendoring.

## Indexed plugin skill families

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

## Source installation reference

```bash
claude plugin marketplace add anthropics/knowledge-work-plugins
claude plugin install productivity@knowledge-work-plugins
claude plugin install sales@knowledge-work-plugins
claude plugin install customer-support@knowledge-work-plugins
claude plugin install product-management@knowledge-work-plugins
claude plugin install marketing@knowledge-work-plugins
claude plugin install legal@knowledge-work-plugins
claude plugin install finance@knowledge-work-plugins
claude plugin install data@knowledge-work-plugins
claude plugin install enterprise-search@knowledge-work-plugins
claude plugin install bio-research@knowledge-work-plugins
claude plugin install cowork-plugin-management@knowledge-work-plugins
```

## Agent rule

When a task requires a domain workflow covered by one of these plugin families, inspect the corresponding upstream plugin content before adapting or copying instructions into this repository.
