# Docker PostgreSQL + Kimi UAT

`Docker PostgreSQL + Kimi UAT` is the protected, manually dispatched acceptance workflow for changes that require all of the following in one run:

- a real Kimi Code response through Claude Agent SDK;
- an authenticated Business Skill Studio session;
- PostgreSQL migrations and database-backed Skill Store;
- a UI save followed by direct PostgreSQL readback;
- separate feature-flow and UAT GIF recordings.

## Security requirement

Never paste a Kimi key into source files, pull requests, issues, workflow inputs, screenshots, logs, or chat transcripts. A key that has been exposed must be revoked and replaced.

Create a GitHub Actions environment named `uat`. Configure this environment secret:

```text
KIMI_API_KEY_PRIMARY
```

Optional, for credential-failover UAT:

```text
KIMI_API_KEY_FALLBACK
```

The primary and fallback values must be different. The endpoint is fixed in the workflow as:

```text
https://api.kimi.com/coding/
```

Do not configure `ANTHROPIC_MODEL` for this Kimi endpoint. The application supplies the Kimi endpoint to Claude Agent SDK and allows Kimi to route the coding model.

Use environment protection rules and required reviewers so that a live credential is released only after the PR code has been reviewed. The workflow accepts same-repository branch names only; do not run it against untrusted fork code.

## Database and authentication

The workflow starts `postgres:17-alpine` as an isolated GitHub Actions service and applies the committed Prisma migrations. It does not connect to a production database.

Authentication and data-source encryption values are generated for each workflow run, masked immediately, and discarded with the runner. No production Auth secret, user password, or database password is required.

## Running the UAT

Open **Actions → Docker PostgreSQL + Kimi UAT → Run workflow** from the trusted default branch and provide:

| Input | Meaning |
| --- | --- |
| `pr_number` | PR that should receive the evidence block |
| `head_ref` | Same-repository PR branch to test and update |
| `uat_tester` | Real person executing or accepting the UAT |

The workflow executes this acceptance path:

1. Start Docker PostgreSQL and apply migrations.
2. Generate a temporary administrator login.
3. Start Business Skill Studio with `SKILL_STORE_DRIVER=database`.
4. Sign in and submit a representative business request.
5. Verify the response came from Claude Agent SDK using a live Kimi credential.
6. Generate a Skill draft.
7. Save a unique Skill through the authenticated UI.
8. Query PostgreSQL directly and verify ID, name, version, and Skill content.
9. Produce a feature screenshot/GIF and a separate PostgreSQL UAT screenshot/GIF.
10. Publish the evidence under `pr-evidence/pr-<number>/uat-real-stack/latest/` and inline it in the PR.

## Evidence interpretation

The generated `uat-record.md` identifies the supplied real tester and the concrete acceptance task. Automated execution evidence supports that person's acceptance decision; it does not authorize using a fictional persona as the actual tester.

The workflow never prints Kimi credentials or includes them in media. Server logs are retained only as a short-lived Actions artifact and committed evidence file; application logging must continue to redact all credentials and authorization values.
