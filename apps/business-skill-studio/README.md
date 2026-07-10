# Business Skill Studio

A project-level app for helping experts from different companies turn recurring know-how into reusable, versioned skills.

## What this app does

1. Creates company records and organization-scoped workspaces.
2. Stores expert profiles, roles, specialties, and business context.
3. Lets an expert chat naturally about a recurring workflow.
4. Uses the server-side live model provider to ask focused follow-up questions.
5. Produces `SKILL.md`, `evals/evals.json`, assumptions, and open questions.
6. Saves every Skill revision inside the selected company scope.
7. Stores and tests read-only MySQL / OceanBase MySQL customer data sources.

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

Generate the password hash with:

```bash
npm run auth:hash-password -- "replace_this_password"
```

## Application database

PostgreSQL stores:

- organizations;
- experts;
- encrypted customer data-source settings;
- connection-test status summaries;
- organization-scoped Skills and immutable Skill revisions.

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

The UI does not accept arbitrary SQL. The result includes:

- each test step and its status;
- latency and server version;
- inferred read-only status from grants;
- warnings for broad privileges;
- table/view and column metadata.

Use a dedicated customer account with only `SELECT` and `SHOW VIEW` wherever possible.

### Network target policy

In production, private, loopback, link-local, multicast, and reserved addresses are blocked by default to reduce server-side request forgery risk.

Explicitly allow private targets only when required:

```bash
ALLOW_PRIVATE_DATA_SOURCE_HOSTS=true
```

Restrict production hosts with a comma-separated suffix allowlist:

```bash
DATA_SOURCE_ALLOWED_HOST_SUFFIXES=oceanbase.customer-a.example,db.customer-b.example
```

The resolver validates all returned addresses and connects to a resolved IP rather than re-resolving during the connection.

## Local FMCG source database

`docker-compose.db.yml` starts a MySQL database on port `3307` with a representative `uat_dws` schema:

- `dim_product`
- `dim_store`
- `dim_customer`
- `fact_sales_daily`
- `fact_inventory_snapshot`
- `vw_brand_sales_summary`

Use the **填入本地 FMCG 测试库** button on `/settings`, or enter:

```text
host: 127.0.0.1
port: 3307
user: fmcg_readonly
password: local-fmcg-readonly
database: uat_dws
charset: utf8mb4
```

These credentials are local test fixtures only. They must never be reused outside local development or CI.

## Skill Store

The Skill Store supports two backends:

| Driver | Configuration | Intended use |
| --- | --- | --- |
| `filesystem` | `SKILL_STORE_DRIVER=filesystem` | Local/demo Skill persistence |
| `database` | `SKILL_STORE_DRIVER=database` and `DATABASE_URL=...` | PostgreSQL Skill persistence |

Both backends now isolate company Skills. Filesystem mode stores organization Skills under:

```text
data/generated-skills/organizations/<organization-id>/<skill-slug>/
```

PostgreSQL uses a composite `(scope_key, slug)` uniqueness constraint. Existing unscoped Skills remain in the `global` scope.

Each save creates an immutable revision. The latest revision is the current content.

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

Storage-independent and security tests:

```bash
npm run test:unit
```

PostgreSQL and local customer-database integration tests:

```bash
TEST_DATABASE_URL="$DATABASE_URL" \
TEST_CUSTOMER_DB_HOST=127.0.0.1 \
TEST_CUSTOMER_DB_PORT=3307 \
TEST_CUSTOMER_DB_ROOT_PASSWORD=local-root-password \
npm run test:integration
```

Application validation:

```bash
npm run typecheck
npm run build
```

The `Database Integration` workflow starts PostgreSQL 17 and MySQL 8.4, applies committed migrations, initializes the FMCG schema, tests encrypted data-source persistence, verifies the read-only connection process, checks organization isolation, typechecks, and builds the application.

## Current scope

Included:

- administrator authentication;
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
- Skill packaging, eval execution, and streaming model output.
