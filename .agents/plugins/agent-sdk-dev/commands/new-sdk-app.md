---
description: Create and setup a new Claude Agent SDK application
argument-hint: [project-name]
---

# New SDK App

This project-level command is adapted from Anthropic's official `agent-sdk-dev` plugin.

## Reference documentation

Before scaffolding or modifying an Agent SDK app, check the official docs:

- Agent SDK overview: https://docs.claude.com/en/api/agent-sdk/overview
- TypeScript SDK: https://docs.claude.com/en/api/agent-sdk/typescript
- Python SDK: https://docs.claude.com/en/api/agent-sdk/python

## Requirements interview

Ask one question at a time:

1. TypeScript or Python?
2. Project name?
3. Agent type: coding, business, or custom?
4. Starting point: minimal, basic, or use-case-specific?
5. Tooling preference: npm/yarn/pnpm/bun or pip/poetry?

## TypeScript setup checklist

- Create `package.json` with `type: module`.
- Add `@anthropic-ai/claude-agent-sdk` at the latest stable version.
- Add `tsconfig.json` with modern ESM-compatible settings.
- Add `src` or app route files with a basic query example.
- Add `.env.example` with `ANTHROPIC_API_KEY=your_api_key_here`.
- Add `.env` and `.env.local` to `.gitignore`.
- Add scripts for `typecheck`, `build`, and `start`.
- Run `npx tsc --noEmit` and fix all errors before calling setup complete.

## Python setup checklist

- Create `requirements.txt` or `pyproject.toml`.
- Add `claude-agent-sdk`.
- Add `main.py` with a basic query example.
- Add `.env.example` and `.gitignore`.
- Run syntax/import validation before calling setup complete.

## Verification

After setup, use the appropriate verifier guidance:

- `agents/agent-sdk-verifier-ts.md` for TypeScript.
- `agents/agent-sdk-verifier-py.md` for Python if added later.

This repository's `apps/business-skill-studio` app is the TypeScript starting point for business-expert skill creation workflows.
