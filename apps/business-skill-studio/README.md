# Business Skill Studio

A project-level app scaffold for helping business experts chat with AI and turn recurring know-how into reusable Claude skills.

## What this app does

1. Lets a business expert chat naturally about a recurring workflow.
2. Uses a server-side Agent SDK adapter to ask focused follow-up questions.
3. Applies the Anthropic `skill-creator` workflow to draft:
   - `SKILL.md`
   - `evals/evals.json`
   - assumptions and open questions
4. Saves generated skills to a versioned Skill Store for review and later packaging.

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

## Skill Store

The Skill Store supports two interchangeable backends:

| Driver | Configuration | Intended use |
| --- | --- | --- |
| `filesystem` | `SKILL_STORE_DRIVER=filesystem` | Default local/demo mode with no database dependency |
| `database` | `SKILL_STORE_DRIVER=database` and `DATABASE_URL=...` | PostgreSQL-backed persistent storage |

Both backends use the same application interface and return storage-neutral metadata:

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
npm run db:generate         # regenerate the Prisma client
npm run db:migrate          # create/apply development migrations
npm run db:migrate:deploy   # apply committed migrations in CI/production
npm run db:studio           # inspect data with Prisma Studio
```

Production and test deployments should run `npm run db:migrate:deploy` before starting the application.

## TypeScript Effect usage

Server-side operational boundaries use the `effect` package for typed error handling and explicit async workflows:

- `lib/effect-runtime.ts` defines `AppError`, `tryPromiseEffect`, `trySyncEffect`, and `runAppEffect`.
- `lib/agent-sdk.ts` wraps Agent SDK imports, query calls, and output collection in `Effect.gen` programs.
- the filesystem repository wraps local file operations in the same error boundary.
- the PostgreSQL repository uses Prisma transactions with serializable isolation and retry handling for concurrent revision creation.

The UI and API route surfaces stay simple; operational error handling is concentrated at I/O boundaries.

## Run locally

```bash
cd apps/business-skill-studio
npm install
cp .env.example .env.local
# Fill ANTHROPIC_API_KEY and auth variables in .env.local
npm run dev
```

Open `http://localhost:3000` and sign in at `/login`.

The app includes a deterministic fallback path when `ANTHROPIC_API_KEY` is missing. That lets product/design review the UI and Skill flow before Agent SDK credentials are configured.

## Validation

Run storage-independent tests:

```bash
npm run test:unit
```

Run PostgreSQL integration tests after starting the local database and applying migrations:

```bash
npm run db:migrate:deploy
TEST_DATABASE_URL="$DATABASE_URL" npm run test:integration
```

Validate the application build:

```bash
npm run typecheck
npm run build
```

The `Database Integration` GitHub Actions workflow starts a PostgreSQL service and verifies migrations, filesystem fallback behavior, database revisions, concurrent saves, and TypeScript compilation on every relevant pull request.

## Upstream references

- Skill authoring pattern: `anthropics/skills/skills/skill-creator`
- Chat / agent app pattern: `anthropics/claude-plugins-official/plugins/agent-sdk-dev`
- Existing project plugin/skill store: repository-level `.agents/` with `.codex/` mirror

## MVP scope

Included:

- Email/password authentication for an environment-backed admin user
- Chat UI for business expert discovery
- Agent SDK adapter with fallback behavior
- Skill draft generation API
- Versioned PostgreSQL Skill Store
- Versioned local filesystem fallback
- Prisma migrations and real PostgreSQL integration tests
- TypeScript Effect wrappers for Agent SDK and filesystem I/O
- Project-level `.agents` and `.codex` references for `skill-creator` and `agent-sdk-dev`

Not yet included:

- Multi-user tenancy
- Database-backed Auth.js users and sessions
- Skill packaging as `.skill`
- Automated eval runner and benchmark viewer integration
- Streaming UI for partial agent output
