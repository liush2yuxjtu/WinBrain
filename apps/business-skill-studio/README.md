# Business Skill Studio

A project-level app scaffold for helping business experts chat with AI and turn recurring know-how into reusable skills.

## What this app does

1. Lets a business expert chat naturally about a recurring workflow.
2. Uses the server-side live model provider to ask focused follow-up questions.
3. Applies the `skill-creator` workflow to draft:
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

## Run locally

```bash
cd apps/business-skill-studio
npm install
cp .env.example .env.local
# Fill live-model and auth variables in .env.local
npm run dev
```

Open `http://localhost:3000` and sign in at `/login`.

The app retains its deterministic fallback when live-model credentials are missing, so product and design review can continue without an external provider.

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

Validate the application:

```bash
npm run typecheck
npm run build
```

The `Database Integration` GitHub Actions workflow starts PostgreSQL and verifies migrations, filesystem fallback behavior, database revisions, concurrent saves, TypeScript compilation, and the production build on every relevant pull request.

## Implementation notes

- Prisma is isolated behind a repository interface rather than imported by API routes or UI components.
- PostgreSQL revision creation uses serializable transactions and retries retryable conflicts.
- `evals.json` is parsed and normalized before persistence.
- Filesystem mode remains the default, preserving the existing no-database development path.
- Auth remains the existing environment-backed single-admin implementation.

## MVP scope

Included:

- Email/password authentication for an environment-backed admin user
- Chat UI and the existing live model provider
- Skill draft generation API
- Versioned PostgreSQL Skill Store
- Versioned local filesystem fallback
- Prisma migrations and real PostgreSQL integration tests
- Project-level `.agents` and `.codex` references

Not yet included:

- Multi-user tenancy
- Database-backed Auth.js users and sessions
- Skill packaging as `.skill`
- Automated eval runner and benchmark viewer integration
- Streaming UI for partial model output
