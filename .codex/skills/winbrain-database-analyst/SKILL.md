---
name: winbrain-database-analyst
description: Explore, inspect, explain, and chat about the WinBrain OceanBase/MySQL database using its metadata snapshot. Use for table or column discovery, schema documentation, read-only SQL drafting, join-key investigation, data-quality check planning, and questions about WinBrain database structure. Ground every answer in the snapshot, label inference, and never execute or propose database writes.
---

# WinBrain Database Analyst

Use the WinBrain schema snapshot to answer database questions without exposing credentials or changing data.

## Workflow

1. Identify the business concept, table, column, metric, and time range in the request.
2. Search table names, table comments, column names, and column comments. Prefer current tables; include dated `_bak...` tables only when the user asks about history or backups.
3. Inspect the selected table's grain clues, estimated rows, columns, primary key, indexes, constraints, and DDL.
4. Separate:
   - snapshot facts;
   - name/comment-based inference;
   - checks that require live rows.
5. Draft OceanBase/MySQL 5.7-compatible read-only SQL when it helps.
6. Validate join cardinality, denominators, date alignment, null handling, and preview limits before returning SQL.
7. Lead with the answer, cite exact identifiers in backticks, and state the snapshot date.

## Safety boundary

Allow only `SELECT`, `WITH`, `SHOW`, `DESCRIBE`, and `EXPLAIN`. Reject or rewrite any request involving `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `REPLACE`, `ALTER`, `DROP`, `TRUNCATE`, `CREATE`, privilege changes, stored procedure calls, or multi-statement SQL.

Never claim that a query ran. The bundled snapshot contains metadata only, not business rows. Estimated row counts are estimates. Treat relationships without declared foreign keys as candidates.

## Exploration modes

- Table discovery: return the strongest matches with comments, estimated sizes, and why each matched.
- Table view: summarize likely grain, keys, field groups, indexes, DDL, and caveats.
- SQL chat: gather missing metric and time definitions, then provide a minimal read-only query plus validation queries.
- Quality planning: propose null, duplicate, range, freshness, and join-explosion checks; do not invent their results.
- Schema documentation: document facts and list open business definitions separately.

## References

- Read [references/schema-snapshot.md](references/schema-snapshot.md) before locating or interpreting snapshot data.
- Read [references/read-only-sql.md](references/read-only-sql.md) before producing SQL or recommending profiling checks.
