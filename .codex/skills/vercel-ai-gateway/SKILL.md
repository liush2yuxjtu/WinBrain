---
name: vercel-ai-gateway
description: Vercel AI Gateway expert guidance. Use when configuring model routing, provider failover, cost tracking, or managing multiple AI providers through a unified API.
metadata:
  author: Vercel
  source: https://github.com/vercel/vercel-plugin
  upstreamPath: skills/ai-gateway/SKILL.md
  priority: 7
  docs:
    - https://vercel.com/docs/ai-gateway
    - https://sdk.vercel.ai/docs/ai-sdk-core/settings
---

# Vercel AI Gateway

Before writing gateway code, fetch the current Vercel AI Gateway docs and provider/model list. Model slugs, routing rules, and authentication behavior change frequently.

## Core usage

Use `provider/model` format, for example `openai/gpt-5.4` or `anthropic/claude-sonnet-4.6`. Prefer discovering available model IDs before hardcoding them.

```ts
import { generateText } from 'ai'

const result = await generateText({
  model: 'openai/gpt-5.4',
  prompt: 'Hello!',
})
```

Use `gateway()` only when you need explicit gateway options such as provider order, failover, tags, or per-user routing.

```ts
import { generateText, gateway } from 'ai'

const result = await generateText({
  model: gateway('anthropic/claude-sonnet-4.6'),
  providerOptions: {
    gateway: {
      order: ['anthropic', 'bedrock'],
      models: ['openai/gpt-5.4'],
      user: 'user-123',
      tags: ['feature:chat', 'env:production'],
    },
  },
  prompt: 'Hello!',
})
```

## Model slug rules

- Use `provider/model` format.
- Versioned model slugs use dots, not hyphens.
- Do not default to outdated models without checking the docs.
- Prefer AI Gateway for production apps, multi-provider failover, observability, cost attribution, and per-user rate limiting.

## Authentication

For Vercel projects, prefer OIDC setup:

```bash
vercel link
vercel env pull .env.local
```

For CI or non-Vercel environments, use `AI_GATEWAY_API_KEY` when OIDC is not available.

## Error handling

Handle budget and rate-limit errors explicitly:

- HTTP 402: budget or hard spending limit exceeded.
- HTTP 429: rate limit exceeded.
- HTTP 503: provider unavailable.

## Official documentation

- https://vercel.com/docs/ai-gateway
- https://ai-sdk.dev/docs/foundations/providers-and-models
- https://ai-sdk.dev/docs/ai-sdk-core

## Source

Condensed from `vercel/vercel-plugin/skills/ai-gateway/SKILL.md`. The upstream file is larger; use the upstream repo for the full executable Claude plugin behavior.
