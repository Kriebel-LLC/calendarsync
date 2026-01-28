# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Starter SaaS template for Kriebel LLC. Yarn monorepo with packages for building full-stack serverless applications.

## Monorepo Structure

All packages are in `packages/`:

- **shared**: Core business logic, database schema (Drizzle ORM), utilities. No dependencies on other packages. Import in all other packages.
- **components**: shadcn/ui component library. Depends only on shared.
- **web**: Next.js frontend + API routes. Hosted on Cloudflare Pages via `@opennextjs/cloudflare`. Should not be imported by other packages.
- **worker**: Cloudflare Worker for async jobs, crons, queues, public API. Should not be imported by other packages.
- **appsscript**: Google Apps Script package built with webpack and deployed via `clasp`.
- **extension**: Browser extension built with React, TypeScript, and webpack.

## Common Commands

**Web (Next.js):**
```bash
yarn web              # Start dev server
yarn web:build        # Build for production
yarn web:lint         # Lint code
yarn workspace web precommit  # Fix lint/prettier + typecheck
```

**Worker (Cloudflare):**
```bash
yarn workspace worker start  # Start with wrangler dev
yarn workspace worker deploy # Deploy to production
yarn workspace worker precommit  # Fix lint/prettier + typecheck
```

**Database (shared package):**
```bash
cd packages/shared
yarn db:migrate-gen    # Generate migration from schema changes
yarn db:migrate-local  # Apply migrations to local D1
yarn db:migrate-staging # Apply to staging
yarn db:migrate-prod   # Apply to production
```

**Apps Script:**
```bash
cd packages/appsscript
yarn build            # Build with webpack
yarn deploy           # Build and push via clasp
```

**Extension:**
```bash
cd packages/extension
yarn dev              # Build with webpack watch mode
yarn build            # Production build
yarn test             # Run Jest tests
```

## Tech Stack

- **Language**: TypeScript
- **Frontend**: Next.js (app directory), React, Tailwind CSS, shadcn/ui
- **Backend**: Cloudflare Workers, Cloudflare Pages
- **Database**: Cloudflare D1 (SQLite) via Drizzle ORM
- **Auth**: Firebase Auth with `next-firebase-auth-edge` for edge runtime
- **Validation**: Zod
- **Logging**: Axiom via `next-axiom`
- **Payments**: Stripe
- **Package Manager**: yarn (NOT npm or pnpm)

## Key Architectural Patterns

### Authentication Flow

- Firebase Auth provides authentication
- `next-firebase-auth-edge` adapts Firebase for edge runtime (required by Cloudflare)
- Middleware (`packages/web/middleware.ts`) handles auth on protected routes
- API routes use `routeHandler` (authenticated) or `noAuthRouteHandler` (public)
- Auth helpers in `packages/web/lib/auth.ts`
- User records lazily created on first authenticated request via `getOrCreateUserRecord()`

### API Routes

All API routes in `packages/web/app/api/` should use route handler wrappers:

```typescript
import { routeHandler } from "@/lib/route";

export const POST = routeHandler(async (req, user) => {
  // req is AxiomRequest (with logger)
  // user is DecodedIdToken (Firebase user)
  // Return NextResponse
});
```

For unauthenticated routes:
```typescript
import { noAuthRouteHandler } from "@/lib/route";

export const POST = noAuthRouteHandler(async (req) => {
  // No user parameter
});
```

### Database Access

Database schema defined in `packages/shared/src/db/schema.ts` using Drizzle ORM.

In web package:
```typescript
import { db } from "@/db";
import { users } from "shared/src/db/schema";

const results = await db().select().from(users);
```

After schema changes, generate and apply migrations from `packages/shared`.

### Worker Structure

Worker entry point: `packages/worker/src/worker.ts`
- Uses `itty-router` for HTTP routing
- Exports `fetch`, `scheduled`, and `queue` handlers
- Cron logic in `packages/worker/src/cron/`
- Queue handlers in `packages/worker/src/queue/`

## Environment Variables

Environment variables should be typed:
- Web: `packages/web/web-env.ts` with validation
- Worker: `packages/worker/src/types.ts` defines `WorkerEnv`

**Important Caveats:**
- `FIREBASE_PRIVATE_KEY` must have all `\n` stripped (Cloudflare limitation)
- `AUTH_COOKIE_SIGNATURE_1` & `AUTH_COOKIE_SIGNATURE_2` must not contain special characters like `=`

## Style Conventions

- Use `Id` not `ID`
- `UpperCamelCase`: class, interface, type, enum, decorator
- `lowerCamelCase`: variable, parameter, function, method, property
- `CONSTANT_CASE`: global constants, enum values
- Prefer `NextRequest`/`NextResponse` over `Request`/`Response` in web package
- Error responses: `{ error: "message" }`
- Omit `{ status: 200 }` (default)
- Always use `routeHandler` or `noAuthRouteHandler` for API routes
