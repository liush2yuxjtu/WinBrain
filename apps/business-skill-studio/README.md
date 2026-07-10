# Business Skill Studio

A project-level app for helping experts from different companies turn recurring know-how into reusable, versioned Claude skills.

## What this app does

1. Creates company records and organization-scoped workspaces.
2. Stores expert profiles, roles, specialties, and business context.
3. Streams Claude Agent SDK status and text updates with primary/fallback credential handling.
4. Produces `SKILL.md`, `evals/evals.json`, assumptions, and open questions.
5. Saves every Skill revision inside the selected company scope.
6. Stores and tests read-only MySQL / OceanBase MySQL customer data sources.

## Security notice

Never commit or paste production database passwords into source files, issue bodies, pull requests, screenshots, or CI logs. Rotate any credential after accidental disclosure.

Customer database passwords are:

- submitted only to authenticated server routes;
- encrypted with AES-256-GCM before being written to PostgreSQL;
- never returned by an API;
- decrypted only for a server-side connection test;
- redacted from connection errors.

Generate a data-source encryption key:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Set the result as `DATA_SOURCE_ENCRYPTION_KEY` in the deployment secret store.

## Authentication

The current app uses Auth.js credentials auth with one environment-backed administrator. That administrator can configure multiple companies and experts. Per-expert login, invitations, and role-based tenant administration are not yet included.

```bash
AUTH_SECRET=replace_with_32_byte_random_secret
NEXTAUTH_URL=http://localhost:3000
AUTH_USER_EMAIL=admin@example.com
AUTH_USER_NAME="Studio Admin"
AUTH_USER_ROLE=admin
AUTH_USER_PASSWORD_HASH=replace_with_bcrypt_hash
```

## Claude Agent SDK

```bash
ANTHROPIC_API_KEY_PRIMARY=your_primary_api_key
ANTHROPIC_API_KEY_FALLBACK=your_fallback_api_key
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_MODEL=MiniMax-M3
AGENT_SDK_ATTEMPT_TIMEOUT_MS=600000
```

Legacy `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` remain supported for local compatibility. Chat and Skill drafting emit progressive status/text events and switch credentials after SDK errors, timeouts, or quota failures.

## Application database

PostgreSQL stores organizations, experts, encrypted customer data-source settings, connection-test summaries, organization-scoped Skills, and immutable Skill revisions.

Start PostgreSQL and the local FMCG test database:

```bash
cd apps/business-skill-studio
docker compose -f docker-compose.db.yml up -d
```

Configure `.env.local`:

```bash
DATABASE_URL=postgresql://winbrain:winbrain@127.0.0.1:5432/winbrain?schema=public
DATA_SOURCE_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
ALLOW_PRIVATE_DATA_SOURCE_HOSTS=true
```

Install and migrate:

```bash
npm install
npm run db:migrate
```

Open `/settings` after signing in.

## Company and expert setup

The settings page provides this sequence:

1. **Create company** — name, industry, and company business background.
2. **Add expert** — company, name, role, department, email, specialty, and working context.
3. **Configure data source** — optional expert assignment plus MySQL/OceanBase connection settings.
4. **Test connection** — validation, DNS/address policy, authentication, `SELECT 1`, grants, and schema inspection.
5. **Save encrypted settings** — the password is encrypted and removed from browser-visible responses.

Selecting an expert on the Skill workbench automatically loads the expert role and business context. Saving a Skill records its `organizationId` and optional `expertId`. The same Skill name can exist independently in multiple companies.

## Customer database connection test

Supported source types:

- MySQL 8 compatible databases;
- OceanBase in MySQL compatibility mode.

The test executes only controlled read operations:

```sql
SELECT 1;
SELECT VERSION(), DATABASE(), @@character_set_connection;
SHOW GRANTS FOR CURRENT_USER;
SELECT ... FROM information_schema.TABLES;
SELECT ... FROM information_schema.COLUMNS;
```

The UI does not accept arbitrary SQL. Use a dedicated customer account with only `SELECT` and `SHOW VIEW` wherever possible.

### Network target policy

In production, private, loopback, link-local, multicast, and reserved addresses are blocked by default to reduce server-side request forgery risk.

```bash
ALLOW_PRIVATE_DATA_SOURCE_HOSTS=true
DATA_SOURCE_ALLOWED_HOST_SUFFIXES=oceanbase.customer-a.example,db.customer-b.example
```

The resolver validates all returned addresses and connects to a resolved IP rather than re-resolving during the connection.

## Local FMCG source database

`docker-compose.db.yml` starts a MySQL database on port `3307` with a representative `uat_dws` schema. Use the **填入本地 FMCG 测试库** button on `/settings`, or enter:

```text
host: 127.0.0.1
port: 3307
user: fmcg_readonly
password: local-fmcg-readonly
database: uat_dws
charset: utf8mb4
```

These credentials are local test fixtures only.

## Skill Store

| Driver | Configuration | Intended use |
| --- | --- | --- |
| `filesystem` | `SKILL_STORE_DRIVER=filesystem` | Local/demo Skill persistence |
| `database` | `SKILL_STORE_DRIVER=database` and `DATABASE_URL=...` | PostgreSQL Skill persistence |

Filesystem mode stores organization Skills under:

```text
data/generated-skills/organizations/<organization-id>/<skill-slug>/
```

PostgreSQL uses a composite `(scope_key, slug)` uniqueness constraint. Existing unscoped Skills remain in the `global` scope. Each save creates an immutable revision.

## Run locally

```bash
cd apps/business-skill-studio
npm install
cp .env.example .env.local
docker compose -f docker-compose.db.yml up -d
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`, sign in, then open `/settings`.

## Validation

```bash
npm run test:unit
TEST_DATABASE_URL="$DATABASE_URL" \
TEST_CUSTOMER_DB_HOST=127.0.0.1 \
TEST_CUSTOMER_DB_PORT=3307 \
TEST_CUSTOMER_DB_ROOT_PASSWORD=local-root-password \
npm run test:integration
npm run typecheck
npm run build
```

The `Database Integration` workflow starts PostgreSQL 17 and MySQL 8.4, applies committed migrations, initializes the FMCG schema, tests encrypted data-source persistence, verifies the read-only connection process, checks organization isolation, typechecks, and builds the application.

## Current scope

Included:

- administrator authentication;
- streaming Claude Agent SDK chat and drafting with credential failover;
- multiple organizations and experts;
- organization-scoped Skills;
- encrypted MySQL/OceanBase data-source settings;
- controlled database connection and schema tests;
- PostgreSQL and filesystem Skill persistence;
- local FMCG test schema and automated integration tests.

Not yet included:

- per-expert login and invitations;
- organization administrator roles and row-level authorization;
- production secret-manager adapters for password material;
- arbitrary business-data querying or natural-language SQL;
- Skill packaging and eval execution.
