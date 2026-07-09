---
name: supabase
description: "Use when doing ANY task involving Supabase. Triggers: Supabase products (Database, Auth, Edge Functions, Realtime, Storage, Vectors, Cron, Queues); client libraries and SSR integrations (supabase-js, @supabase/ssr) in Next.js, React, SvelteKit, Astro, Remix; auth issues (login, logout, sessions, JWT, cookies, getSession, getUser, getClaims, RLS); Supabase CLI or MCP server; schema changes, migrations, security audits, Postgres extensions (pg_graphql, pg_cron, pg_vector)."
metadata:
  author: supabase
  version: "0.1.2"
---

# Supabase

## Core Principles

**1. Supabase changes frequently — verify against changelog and current docs before implementing.**
Do not rely on training data for Supabase features. Function signatures, config.toml settings, and API conventions change between versions.

First, fetch `https://supabase.com/changelog.md` (a lightweight summary index — not a heavy pull), scan for `breaking-change` tags relevant to your task, and follow the linked page for any that apply. Then look up the relevant topic using the documentation access methods below.

**2. Verify your work.**
After implementing any fix, run a test query to confirm the change works. A fix without verification is incomplete.

**3. Recover from errors, don't loop.**
If an approach fails after 2-3 attempts, stop and reconsider. Try a different method, check documentation, inspect the error more carefully, and review relevant logs when available. Supabase issues are not always solved by retrying the same command, and the answer is not always in the logs, but logs are often worth checking before proceeding.

**4. Exposing tables to the Data API:** Depending on the user's Data API settings, newly created tables may not be automatically exposed via the Data (REST) API. If this is the case, `anon` and `authenticated` roles will need to be explicitly granted access.

When a user reports a SQL-created table is unexpectedly inaccessible, check their Data API settings and whether the roles have been granted access via explicit `GRANT` SQL. When granting public (`anon`/`authenticated`) access, always enable RLS too.

**5. RLS in exposed schemas.**
Enable RLS on every table in any exposed schema, which includes `public` by default. This is critical in Supabase because tables in exposed schemas can be reachable through the Data API when the `anon`/`authenticated` roles have access. For private schemas, prefer RLS as defense in depth. After enabling RLS, create policies that match the actual access model rather than defaulting every table to the same `auth.uid()` pattern.

**6. Security checklist.**
When working on any Supabase task that touches auth, RLS, views, storage, or user data, run through this checklist:

- Never use `user_metadata` claims in JWT-based authorization decisions; use app metadata instead.
- Deleting a user does not invalidate existing access tokens.
- Never expose `service_role` or secret keys in public clients.
- Views bypass RLS by default; use `security_invoker = true` on Postgres 15+.
- UPDATE requires a SELECT policy.
- `auth.role()` is deprecated — use `TO authenticated` / `TO anon` clauses instead.
- `TO authenticated` alone is authentication without authorization; include ownership predicates.
- UPDATE policies require both `USING` and `WITH CHECK`.
- `SECURITY DEFINER` functions bypass RLS; avoid unless strictly required and protected.
- Storage upsert requires INSERT + SELECT + UPDATE.
- Always pin package versions and commit lockfiles when installing Supabase packages.

For any security concern not covered above, fetch the Supabase product security index: `https://supabase.com/docs/guides/security/product-security.md`.

## Supabase CLI

Always discover commands via `--help` — never guess. The CLI structure changes between versions.

```bash
supabase --help
supabase <group> --help
supabase <group> <command> --help
```

Known gotchas:

- `supabase db query` requires CLI v2.79.0+; use MCP `execute_sql` or `psql` as fallback.
- `supabase db advisors` requires CLI v2.81.3+; use MCP `get_advisors` as fallback.
- When creating a migration SQL file, always create it with `supabase migration new <name>` first.

## Supabase MCP Server

For setup instructions, server URL, and configuration, see `https://supabase.com/docs/guides/getting-started/mcp`.

Troubleshooting connection issues:

1. Check reachability: `curl -so /dev/null -w "%{http_code}" https://mcp.supabase.com/mcp`; `401` is expected without a token.
2. Check `.mcp.json` configuration.
3. Authenticate via the OAuth 2.1 flow and reload the session.

## Supabase Documentation

Before implementing any Supabase feature, find the relevant documentation using this priority:

1. MCP `search_docs` tool.
2. Fetch docs pages as markdown by appending `.md` to the URL path.
3. Web search for Supabase-specific topics when the page is unknown.

## Making and Committing Schema Changes

Use `execute_sql` (MCP) or `supabase db query` (CLI) to iterate. Do not use `apply_migration` to change a local database schema during iteration.

When ready to commit:

1. Run advisors: `supabase db advisors` or MCP `get_advisors`.
2. Review the security checklist.
3. Generate the migration: `supabase db pull <descriptive-name> --local --yes`.
4. Verify: `supabase migration list --local`.

## Source

Vendored from `supabase-community/supabase-plugin/skills/supabase/SKILL.md`.
