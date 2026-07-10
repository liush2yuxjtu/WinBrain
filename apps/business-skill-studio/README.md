# Business Skill Studio

A project-level app for helping experts from different companies turn recurring know-how into reusable, versioned Claude skills.

## What this app does

1. Creates company records and organization-scoped workspaces.
2. Stores expert profiles, roles, specialties, and business context.
3. Streams Kimi Code responses through Claude Agent SDK with primary/fallback credential handling.
4. Produces `SKILL.md`, `evals/evals.json`, assumptions, and open questions.
5. Saves every Skill revision inside the selected company scope.
6. Provides a Skill library for searching, creating, importing, editing, exporting, and deleting generated skills.
7. Stores and tests read-only MySQL / OceanBase MySQL customer data sources.

## Security notice

Never commit or paste production Kimi API keys, database passwords, or other secrets into source files, issue bodies, pull requests, screenshots, or CI logs. Rotate any credential after accidental disclosure.

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

Protected resources:

- all app pages except `/login`
- `/api/chat`
- `/api/skills`
- `/api/skills/[name]`
- `/api/skills/draft`

Auth routes under `/api/auth/*` stay public for sign-in callbacks.

## Kimi Code via Claude Agent SDK

```bash
KIMI_API_KEY_PRIMARY=your_primary_kimi_api_key
KIMI_API_KEY_FALLBACK=your_fallback_kimi_api_key
KIMI_BASE_URL=https://api.kimi.com/coding/
KIMI_THINKING_TOKENS=32768
CLAUDE_CODE_AUTO_COMPACT_WINDOW=262144
AGENT_SDK_ATTEMPT_TIMEOUT_MS=600000
```

Kimi's Claude-compatible endpoint routes requests to K2.7 Code when Thinking mode is enabled. The app therefore supplies a positive Thinking budget by default, removes stale model overrides from the SDK child process, and lets Kimi select the current coding model. Do not configure `ANTHROPIC_MODEL=kimi-2.7-code`; that is not the model identifier used by this endpoint.

Legacy `KIMI_API_KEY`, `ANTHROPIC_API_KEY_PRIMARY`, `ANTHROPIC_API_KEY_FALLBACK`, `ANTHROPIC_AUTH_TOKEN_PRIMARY`, `ANTHROPIC_AUTH_TOKEN_FALLBACK`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_AUTH_TOKEN` remain supported during migration. Chat and Skill drafting emit progressive status/text events and switch credentials after SDK errors, timeouts, or quota failures.

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

The authenticated CRUD scenario lives at `tests/skill-library.spec.ts` and runs automatically in the PR workflow with an isolated temporary store. To run it locally from the repository root, set `SKILL_LIBRARY_START_SERVER=1`, `SKILL_LIBRARY_URL`, `SKILL_LIBRARY_TEST_EMAIL`, `SKILL_LIBRARY_TEST_PASSWORD`, the matching `AUTH_*` server variables, and an isolated `SKILL_STUDIO_STORAGE_DIR`, then run:

```bash
PLAYWRIGHT_CHANNEL=chromium npx playwright test tests/skill-library.spec.ts --project=chrome
```

The app includes a deterministic fallback path when `ANTHROPIC_API_KEY` is missing. That lets product/design review the UI and skill flow before Agent SDK credentials are configured.

The `Database Integration` workflow starts PostgreSQL 17 and MySQL 8.4, applies committed migrations, initializes the FMCG schema, tests encrypted data-source persistence, verifies the read-only connection process, checks scoped filesystem and database revisions, typechecks, and builds the application.

## Implementation notes

- PostgreSQL revision creation uses serializable transactions and retries retryable conflicts.
- `evals.json` is parsed and normalized before persistence.
- Filesystem mode remains the default, preserving the existing no-database development path.
- Auth remains the environment-backed single-admin implementation.

## Upstream references

- Skill authoring pattern: `anthropics/skills/skills/skill-creator`
- Chat / agent app pattern: `anthropics/claude-plugins-official/plugins/agent-sdk-dev`
- Existing project plugin/skill store: repository-level `.agents/` with `.codex/` mirror

### Skill library management

Open `/skills` after signing in and choose the global scope or a company. The library manages only runtime-generated skills in the configured versioned Skill Store; it does not modify the repository-managed `.agents/skills` or `.codex/skills` trees.

Supported operations:

- Search, filter, sort, and inspect generated skills
- Create a new Skill or import an existing `SKILL.md`
- Edit `SKILL.md` and `evals/evals.json`
- Remove stale evals by saving an empty evals editor
- Export a WinBrain JSON backup
- Delete a generated Skill after confirmation

Managed Skill writes validate required YAML frontmatter and eval JSON. New Skill creation rejects duplicate canonical names inside the selected scope instead of silently adding a revision; edits append immutable revisions. The same slug may exist independently in different company scopes.

## Current scope

Included:

- Administrator email/password authentication
- Streaming Kimi Code (K2.7 Thinking) through Claude Agent SDK with credential failover
- Multiple organizations and experts
- Organization-scoped, versioned PostgreSQL and filesystem Skills
- Authenticated Skill Store CRUD API and management page
- Encrypted MySQL/OceanBase data-source settings and controlled connection tests
- Prisma migrations, real database integration tests, and local FMCG fixtures
- Project-level `.agents` and `.codex` references

Not yet included:

- per-expert login and invitations;
- organization administrator roles and row-level authorization;
- production secret-manager adapters for password material;
- arbitrary business-data querying or natural-language SQL;
- Skill packaging and eval execution.
