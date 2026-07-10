# Business Skill Studio

A project-level app scaffold for helping business experts chat with AI and turn recurring know-how into reusable Claude skills.

## What this app does

1. Lets a business expert chat naturally about a recurring workflow.
2. Uses a server-side Agent SDK adapter to ask focused follow-up questions.
3. Applies the Anthropic `skill-creator` workflow to draft:
   - `SKILL.md`
   - `evals/evals.json`
   - assumptions and open questions
4. Saves generated skills to a local skill store for review and later packaging.
5. Provides a Skill library for searching, creating, importing, editing, exporting, and deleting generated skills.

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
- `/api/skills/[name]`
- `/api/skills/draft`

Auth routes under `/api/auth/*` stay public for sign-in callbacks.

## TypeScript Effect usage

Server-side operational boundaries use the `effect` package for typed error handling and explicit async workflows:

- `lib/effect-runtime.ts` defines `AppError`, `tryPromiseEffect`, `trySyncEffect`, and `runAppEffect`.
- `lib/agent-sdk.ts` wraps Agent SDK imports, query calls, and output collection in `Effect.gen` programs.
- `lib/skill-store.ts` wraps filesystem reads/writes and skill metadata listing in Effect programs.

The UI and API route surfaces stay simple; Effect is concentrated at I/O boundaries where failures need consistent handling.

## Upstream references

- Skill authoring pattern: `anthropics/skills/skills/skill-creator`
- Chat / agent app pattern: `anthropics/claude-plugins-official/plugins/agent-sdk-dev`
- Existing project plugin/skill store: repository-level `.agents/` with `.codex/` mirror

## Run locally

```bash
cd apps/business-skill-studio
npm install
cp .env.example .env.local
# Fill ANTHROPIC_API_KEY and auth variables in .env.local
npm run dev
```

Open `http://localhost:3000` and sign in at `/login`.

## Validation

```bash
cd apps/business-skill-studio
npm run typecheck
npm run build
```

The authenticated CRUD scenario lives at `tests/skill-library.spec.ts` and runs automatically in the PR workflow with an isolated temporary store. To run it locally from the repository root, set `SKILL_LIBRARY_START_SERVER=1`, `SKILL_LIBRARY_URL`, `SKILL_LIBRARY_TEST_EMAIL`, `SKILL_LIBRARY_TEST_PASSWORD`, the matching `AUTH_*` server variables, and an isolated `SKILL_STUDIO_STORAGE_DIR`, then run:

```bash
PLAYWRIGHT_CHANNEL=chromium npx playwright test tests/skill-library.spec.ts --project=chrome
```

The app includes a deterministic fallback path when `ANTHROPIC_API_KEY` is missing. That lets product/design review the UI and skill flow before Agent SDK credentials are configured.

## Data storage

Generated skills are written under:

```text
apps/business-skill-studio/data/generated-skills/
```

Override with:

```bash
SKILL_STUDIO_STORAGE_DIR=/absolute/or/relative/path
```

The default local storage directory is ignored by git.

### Skill library management

Open `/skills` after signing in. The library manages only runtime-generated skills in the configured local store; it does not modify the repository-managed `.agents/skills` or `.codex/skills` trees.

Supported operations:

- Search, filter, sort, and inspect local skills
- Create a new Skill or import an existing `SKILL.md`
- Edit `SKILL.md` and `evals/evals.json`
- Remove stale evals by saving an empty evals editor
- Export a WinBrain JSON backup
- Delete a generated Skill after confirmation

Skill writes validate required YAML frontmatter and eval JSON. New Skill creation rejects duplicate canonical names instead of silently overwriting them. The local filesystem store is intended for a single-instance MVP; production multi-instance or multi-tenant deployments should move persistence to shared storage with ownership controls.

## MVP scope

Included:

- Email/password authentication for an environment-backed admin user
- Chat UI for business expert discovery
- Agent SDK adapter with fallback behavior
- Skill draft generation API
- Local Skill Store CRUD API with validation and atomic file replacement
- Authenticated Skill library management page
- TypeScript Effect wrappers for Agent SDK and filesystem I/O
- Project-level `.agents` and `.codex` references for `skill-creator` and `agent-sdk-dev`

Not yet included:

- Multi-user tenancy
- Database-backed persistent storage
- Skill packaging as `.skill`
- Automated eval runner and benchmark viewer integration
- Streaming UI for partial agent output
