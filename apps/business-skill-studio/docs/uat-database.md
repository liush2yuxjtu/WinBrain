# WinBrain UAT database environment

This environment provides a repeatable UAT data stack for Business Skill Studio without committing credentials or depending on a developer's local database.

## Components

| Service | Purpose | Default host port |
| --- | --- | --- |
| PostgreSQL 17 | Organizations, experts, encrypted data-source settings, Skills, and immutable revisions | `55432` |
| MySQL 8.4 | OceanBase/MySQL-compatible FMCG customer fixture | `53307` |

The UAT stack uses separate Docker volumes and ports from `docker-compose.db.yml`, so local development data is not reused.

## Bootstrap

```bash
cd apps/business-skill-studio
npm ci
cp .env.uat.example .env.uat
```

Replace every placeholder password and generate the application secrets:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
npm run auth:hash-password -- "replace_this_uat_password"
```

Start, migrate, seed, and verify the complete stack:

```bash
npm run uat:db:bootstrap
```

The bootstrap is idempotent. It:

1. starts PostgreSQL and MySQL and waits for both health checks;
2. applies committed Prisma migrations with `prisma migrate deploy`;
3. upserts a UAT organization, supply-chain expert, Skill, and first Skill revision;
4. verifies completed migrations and seeded application records;
5. connects to the FMCG fixture with its read-only account;
6. verifies fixture row counts and rejects accounts with write grants.

## Commands

```bash
npm run uat:db:up
npm run uat:db:migrate
npm run uat:db:seed
npm run uat:db:verify
npm run uat:db:status
npm run uat:db:down
```

Rebuild from empty volumes:

```bash
npm run uat:db:reset
```

Remove containers and all UAT data:

```bash
npm run uat:db:destroy
```

## Run the application against UAT

The lifecycle script derives `DATABASE_URL` from the `UAT_POSTGRES_*` values while it runs. For the application process, keep the equivalent `DATABASE_URL` in `.env.uat` and load those variables into the deployment/runtime environment.

Required application settings include:

```text
SKILL_STORE_DRIVER=database
DATABASE_URL=postgresql://...
DATA_SOURCE_ENCRYPTION_KEY=...
AUTH_SECRET=...
AUTH_USER_PASSWORD_HASH=...
```

The MySQL fixture can be registered through `/settings` with:

```text
host: 127.0.0.1
port: 53307
database: uat_dws
username: value of UAT_MYSQL_READONLY_USER
password: value of UAT_MYSQL_READONLY_PASSWORD
charset: utf8mb4
```

`ALLOW_PRIVATE_DATA_SOURCE_HOSTS=true` is appropriate only for this isolated local/CI UAT network. Production should retain the default private-address block unless an explicit network policy is in place.

## Kimi configuration

Kimi credentials are independent from database bootstrap. Put them in a deployment secret store or an untracked `.env.uat`; never place a real key in `.env.uat.example`, Compose YAML, source code, PR text, screenshots, or logs.

```text
KIMI_API_KEY_PRIMARY=<secret>
KIMI_API_KEY_FALLBACK=<optional-secret>
KIMI_BASE_URL=https://api.kimi.com/coding/
```

A database verification pass does not prove Kimi authentication. A complete UAT acceptance run should separately require a successful live-model chat, Skill draft, PostgreSQL save, and API read-back.

## CI

`.github/workflows/uat-database.yml` creates an ephemeral `.env.uat` with CI-only credentials, bootstraps the stack, runs the verification, and destroys all volumes in an `always()` cleanup step. No CI fixture password is intended for use outside the disposable Actions runner.

## Seeded records

The application database contains deterministic UAT fixtures:

- organization slug: `uat-fmcg`;
- expert email: `uat-supply@example.com`;
- Skill slug: `uat-inventory-exception-response`;
- at least one immutable Skill revision.

The MySQL database contains product, store, customer, daily-sales, inventory-snapshot, and brand-sales-view fixtures. Its application-facing user receives only `SELECT` and `SHOW VIEW`.
