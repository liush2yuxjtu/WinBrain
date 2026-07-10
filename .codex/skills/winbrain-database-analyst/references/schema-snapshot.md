# Schema snapshot

## Source

The repository snapshot is:

`user_upload/win_brain_db_schema_export_2026-07-09/win-brain-oceanbase-schema-2026-07-09.json`

It describes the `uat_dws` database on OceanBase 4.3.1 with MySQL 5.7 compatibility. It was generated on 2026-07-09 and contains metadata only.

Snapshot counts:

- 269 tables
- 7,717 columns
- 135 index records
- 129 constraints

The JSON sections are `metadata`, `table_summaries`, `tables`, `columns`, `indexes`, `constraints`, `key_usage`, and `ddl_by_table`.

## Grounding rules

- Cite exact table and column identifiers.
- Treat `rows_estimate` as approximate.
- Do not infer sample values, distributions, null rates, or freshness from DDL.
- Do not treat similarly named columns as proven join keys.
- Prefer non-backup tables unless the request explicitly concerns historical copies.
- State when comments are missing or ambiguous.
- Ask for business definitions when terms such as customer, sales, stock, order, distributor, and KPI can map to multiple entities.

## App surfaces

The server-side catalog and search logic lives in `apps/business-skill-studio/lib/database-schema.ts`.

The authenticated explorer endpoints are:

- `GET /api/database/schema`
- `GET /api/database/schema?table=<exact_table_name>`
- `POST /api/database/chat`

The dedicated Agent SDK grounding and prompt boundary lives in `apps/business-skill-studio/lib/database-agent.ts`.

## Upstream patterns

This skill adapts the schema-first, context-extraction, query-writing, and validation workflows from:

- https://github.com/anthropics/knowledge-work-plugins/tree/main/data
- https://github.com/anthropics/claude-plugins-official/tree/main/plugins/agent-sdk-dev
