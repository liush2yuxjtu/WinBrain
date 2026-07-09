---
name: vercel-ai-sdk
description: Vercel AI SDK expert guidance. Use when building AI-powered features — chat interfaces, text generation, structured output, tool calling, agents, MCP integration, streaming, embeddings, reranking, image generation, or working with any LLM provider.
metadata:
  author: Vercel
  source: https://github.com/vercel/vercel-plugin
  upstreamPath: skills/ai-sdk/SKILL.md
  priority: 8
  docs:
    - https://sdk.vercel.ai/docs
    - https://sdk.vercel.ai/docs/reference
---

# Vercel AI SDK

Use this skill when implementing AI-powered features with the Vercel AI SDK, including chat, completion, streaming, tool calling, structured output, embeddings, reranking, image generation, MCP integration, and agent loops.

## Activation signals

- Imports from `ai` or `@ai-sdk/*`
- API routes such as `app/api/chat/**`, `pages/api/chat/**`, `app/api/completion/**`, or AI utility modules under `lib/ai/**`
- Prompts mentioning AI SDK, Vercel AI, `generateText`, `streamText`, `useChat`, `useCompletion`, tool calling, embeddings, or structured output

## Guidance

- Prefer current AI SDK docs over memory.
- Use the AI SDK provider model abstraction instead of direct vendor SDKs unless vendor-specific features are required.
- For production apps needing observability, failover, cost tracking, or budget controls, pair with the `vercel-ai-gateway` skill.
- Validate streaming and tool-call behavior with runtime tests, not only type checks.

## Official documentation

- https://sdk.vercel.ai/docs
- https://sdk.vercel.ai/docs/reference
- https://github.com/vercel/ai

## Source

Condensed from `vercel/vercel-plugin/skills/ai-sdk/SKILL.md` and its generated skill manifest.
