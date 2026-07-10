# Business Skill Studio

A project-level app for helping business experts chat with AI and turn recurring know-how into reusable, versioned Claude skills.

## What this app does

1. Lets a business expert chat naturally about a recurring workflow.
2. Streams server-side Claude Agent SDK status and text updates, with primary/secondary credential failover.
3. Applies the Anthropic `skill-creator` workflow to draft:
   - `SKILL.md`
   - `evals/evals.json`
   - assumptions and open questions
4. Saves generated skills to a versioned Skill Store for review and later packaging.

The application only presents chat or Skill content returned by the real Claude Agent SDK. It does not generate deterministic substitute content when configuration or upstream calls fail.

## Authentication

The app uses Auth.js / NextAuth credentials auth with a single environment-backed admin user.

Set these in `.env.local` or your deployment secret store:

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
- `/api/skills/draft`

Auth routes under `/api/auth/*` stay public for sign-in callbacks.

## Claude Agent SDK

Configure the preferred and optional secondary credentials:

```bash
ANTHROPIC_API_KEY_PRIMARY=your_primary_api_key
ANTHROPIC_API_KEY_FALLBACK=your_secondary_api_key
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_MODEL=MiniMax-M3
AGENT_SDK_ATTEMPT_TIMEOUT_MS=600000
```

Legacy `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` remain supported for local compatibility. Credential failover is a retry against another real credential, not a synthetic implementation.

Failure behavior is explicit:

- no configured credential: API returns HTTP 503;
- one credential fails and another exists: the SDK retries with the next credential and reports the switch;
- every credential fails, the SDK times out, or the stream ends without text: the stream emits an error and the UI shows the failure;
- failed draft generation leaves the editor empty, so failure text cannot be saved as a Skill.

## Skill Store

The Skill Store supports two explicitly selected backends:

| Driver | Configuration | Intended use |
| --- | --- | --- |
| `filesystem` | `SKILL_STORE_DRIVER=filesystem` | Local development or installations that intentionally use files |
| `database` | `SKILL_STORE_DRIVER=database` and `DATABASE_URL=...` | PostgreSQL-backed persistent storage |

Selecting `database` never falls back to the filesystem after a database error. Storage failures propagate to the API as errors.

Both backends return storage-neutral metadata:

- stable Skill ID
- display name and slug
- current revision number
- last update timestamp

Each save creates a new immutable revision. The latest revision remains the current Skill content.

### Filesystem backend

Generated skills are written under:

```text
data/generated-skills/
```

Override the directory with:

```bash
SKILL_STUDIO_STORAGE_DIR=/absolute/or/relative/path
```

The current files remain available at `SKILL.md` and `evals/evals.json`. Historical content is stored under `revisions/<version>/`.

### PostgreSQL backend

Start the local database:

```bash
docker compose -f docker-compose.db.yml up -d
```

Configure `.env.local`:

```bash
SKILL_STORE_DRIVER=database
DATABASE_URL=postgresql://winbrain:winbrain@127.0.0.1:5432/winbrain?schema=public
```

Install dependencies and apply the development migration:

```bash
npm install
npm run db:migrate
```

Useful database commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:studio
```

Production and test deployments should run `npm run db:migrate:deploy` before starting the application.

## TypeScript Effect usage

Server-side operational boundaries use the `effect` package for typed error handling and explicit async workflows. Prisma remains isolated behind a repository interface rather than being imported directly by API routes or UI components.

## Run locally

```bash
cd apps/business-skill-studio
npm install
cp .env.example .env.local
# Fill Agent SDK, auth, and optional database variables in .env.local
npm run dev
```

Open `http://localhost:3000` and sign in at `/login`.

## Validation

Run storage-independent and fail-fast regression tests:

```bash
npm run test:unit
```

The unit suite verifies, among other behavior, that missing Agent SDK credentials throw a configuration error and that stream failures cannot be serialized as successful results.

Run PostgreSQL integration tests after starting the local database and applying migrations:

```bash
npm run db:migrate:deploy
TEST_DATABASE_URL="$DATABASE_URL" npm run test:integration
```

Validate the application:

```bash
npm run typecheck
npm run build
```

The `Database Integration` GitHub Actions workflow starts PostgreSQL and verifies migrations, the explicit filesystem backend, database revisions, concurrent saves, TypeScript compilation, and the production build.

## Implementation notes

- PostgreSQL revision creation uses serializable transactions and retries retryable conflicts.
- `evals.json` is parsed and normalized before persistence.
- Filesystem mode remains available as an explicit backend for local or file-based deployments.
- Auth remains the environment-backed single-admin implementation.

## Upstream references

- Skill authoring pattern: `anthropics/skills/skills/skill-creator`
- Chat / agent app pattern: `anthropics/claude-plugins-official/plugins/agent-sdk-dev`
- Existing project plugin/skill store: repository-level `.agents/` with `.codex/` mirror

## MVP scope

Included:

- Email/password authentication for an environment-backed admin user
- Streaming Claude Agent SDK chat and Skill drafting with real credential failover
- Fail-fast handling for missing credentials and exhausted upstream calls
- Versioned PostgreSQL Skill Store
- Versioned local filesystem backend
- Prisma migrations and real PostgreSQL integration tests
- Project-level `.agents` and `.codex` references

Not yet included:

- Multi-user tenancy
- Database-backed Auth.js users and sessions
- Skill packaging as `.skill`
- Automated eval runner and benchmark viewer integration
