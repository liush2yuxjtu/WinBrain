# Read-only SQL rules

## Allowed statement families

Generate a single statement beginning with one of:

- `SELECT`
- `WITH`
- `SHOW`
- `DESCRIBE`
- `EXPLAIN`

Never place a write statement after an allowed statement. Avoid comments or string tricks that obscure statement boundaries.

## Query construction

- Target OceanBase/MySQL 5.7 behavior.
- Quote identifiers with backticks when names are long, ambiguous, or reserved.
- Avoid `SELECT *` on wide tables. Select the smallest useful field set.
- Add `LIMIT 100` to row previews.
- Make time filters explicit and use comparable complete periods.
- Use `NULLIF` for denominators that can be zero.
- State the intended grain before aggregation.
- Before joins, list candidate keys and expected cardinality.
- Add a row-count or distinct-key check around joins that could multiply rows.

## Safe profiling patterns

Use read-only checks and return them as proposals, never as executed results:

```sql
SELECT
  COUNT(*) AS row_count,
  COUNT(DISTINCT `candidate_key`) AS distinct_key_count
FROM `table_name`;
```

```sql
SELECT
  SUM(`important_column` IS NULL) AS null_count,
  ROUND(100 * SUM(`important_column` IS NULL) / NULLIF(COUNT(*), 0), 2) AS null_rate_pct
FROM `table_name`;
```

```sql
SELECT `candidate_key`, COUNT(*) AS duplicate_count
FROM `table_name`
GROUP BY `candidate_key`
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 100;
```

## Validation checklist

Before returning SQL, verify:

- every identifier exists in the supplied schema context;
- no write or DDL keyword is present;
- no unproven relationship is described as a fact;
- the aggregation grain matches the question;
- rates use an explicit denominator;
- preview queries are bounded;
- the answer states that results require execution against an authorized read-only connection.
