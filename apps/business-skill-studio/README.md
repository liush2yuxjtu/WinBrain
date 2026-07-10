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

## MVP scope

Included:

- Email/password authentication for an environment-backed admin user
- Chat UI for business expert discovery
- Agent SDK adapter with fallback behavior
- Skill draft generation API
- Local skill save/list API
- TypeScript Effect wrappers for Agent SDK and filesystem I/O
- Project-level `.agents` and `.codex` references for `skill-creator` and `agent-sdk-dev`

Not yet included:

- Multi-user tenancy
- Database-backed persistent storage
- Skill packaging as `.skill`
- Automated eval runner and benchmark viewer integration
- Streaming UI for partial agent output
