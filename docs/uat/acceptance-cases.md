# WinBrain User Acceptance Test Catalogue

These ten cases define release-level acceptance for named users completing real business tasks.

## UAT-01 — Chen Yu creates an organization-scoped skill
**Person:** Chen Yu, procurement subject-matter expert at Acme Foods.
**Task:** Create a supplier-risk skill from an expert interview.
**Preconditions:** Chen is authenticated and assigned to Acme Foods.
**Steps:** Open the workspace; enter role, domain, and context; complete the interview; generate and save the skill.
**Acceptance criteria:** `SKILL.md` and `evals/evals.json` are generated; the skill is stored under Acme scope; a revision is created; another organization cannot see it.

## UAT-02 — Maria Santos edits a skill without losing history
**Person:** Maria Santos, process owner.
**Task:** Update an approved month-end-close skill.
**Preconditions:** Revision 1 exists in the organization skill library.
**Steps:** Open the skill; change one procedure and one evaluation; save; inspect revision history.
**Acceptance criteria:** Revision 2 is immutable and current; revision 1 remains readable; scope and slug remain stable; changed files are visible.

## UAT-03 — David Lee imports and exports a portable skill
**Person:** David Lee, automation architect.
**Task:** Import a valid skill package and export it for another environment.
**Preconditions:** Package contains `SKILL.md` and valid evaluations.
**Steps:** Import package; review files; save; export; inspect archive.
**Acceptance criteria:** Import succeeds without path traversal; exported files match stored content; metadata and organization scope are correct; secrets are absent.

## UAT-04 — Aisha Rahman receives a streamed Kimi-assisted draft
**Person:** Aisha Rahman, customer-operations expert.
**Task:** Ask the Copilot to draft a complaint-escalation skill.
**Preconditions:** Real-model mode configured with an approved Kimi primary key.
**Steps:** Submit the request; observe streaming; review the generated draft and timing summary.
**Acceptance criteria:** First content arrives before completion; draft addresses escalation criteria; request completes without exposing prompts, thinking, keys, or raw provider errors.

## UAT-05 — Ben Carter signs in and is denied invalid credentials
**Person:** Ben Carter, studio administrator.
**Task:** Access the workspace using valid credentials, then verify an invalid password is rejected.
**Preconditions:** Auth.js credentials account exists.
**Steps:** Sign in correctly; sign out; retry with a wrong password.
**Acceptance criteria:** Valid login reaches the workspace; invalid login remains on the authentication flow; no session is created; error text does not disclose account existence.

## UAT-06 — Li Na registers a read-only customer database
**Person:** Li Na, data platform engineer.
**Task:** Save and test a MySQL/OceanBase data source.
**Preconditions:** Dedicated account has only `SELECT` and `SHOW VIEW`.
**Steps:** Enter connection details; save; run connection test; reopen settings.
**Acceptance criteria:** Password is encrypted at rest and never returned to the browser; controlled read-only checks pass; grants are displayed safely; no write statement executes.

## UAT-07 — Jacob Miller explores table metadata
**Person:** Jacob Miller, business intelligence analyst.
**Task:** Find an orders table and inspect columns, indexes, constraints, and DDL.
**Preconditions:** FMCG test database is connected.
**Steps:** Open Database Explorer; search `orders`; open the table; inspect each metadata section.
**Acceptance criteria:** Correct table is found; metadata matches the source; DDL is read-only; navigation remains within the selected data source.

## UAT-08 — Fatima Zahra runs a metadata-grounded analysis
**Person:** Fatima Zahra, commercial analyst.
**Task:** Ask which fields support monthly revenue analysis.
**Preconditions:** Database metadata is available; analysis agent is enabled.
**Steps:** Select the sales schema; ask the question; inspect cited tables and fields.
**Acceptance criteria:** Answer uses existing metadata only; named tables/columns exist; unsupported assumptions are marked; no customer row data or credentials are exposed.

## UAT-09 — Noah Williams verifies tenant isolation
**Person:** Noah Williams, security reviewer for Beta Retail.
**Task:** Search for Acme Foods skills while signed into Beta Retail.
**Preconditions:** Both organizations contain distinct skills.
**Steps:** Sign in as Noah; search the library for an Acme-only slug; call the corresponding API route.
**Acceptance criteria:** UI and API return no Acme content; direct identifiers cannot bypass scope; audit/error output contains no cross-tenant data.

## UAT-10 — Emma Dubois validates production persistence
**Person:** Emma Dubois, release manager.
**Task:** Prove that a skill saved through the production UI survives restart and is read back from PostgreSQL.
**Preconditions:** Production build, authentication, PostgreSQL, and database skill-store driver are active.
**Steps:** Create a uniquely named skill; save; restart the application; sign in; reopen the skill.
**Acceptance criteria:** Skill and revision are restored from PostgreSQL; content matches the saved version; evidence includes Playwright result and screenshot/video; fallback filesystem storage was not used.
