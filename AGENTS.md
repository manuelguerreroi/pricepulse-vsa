# AGENTS.md — PricePulse Engineering Directives

This document defines the strict, non-negotiable architectural constraints and engineering standards for all AI agents and developers working on the PricePulse codebase.

---

## 1. Core Architecture: Vertical Slice Architecture (VSA)

- **Topology:**
  - `src/shared/`: Kernel primitives only (DB client, NATS bootstrap, Valkey factory, Outbox Relay, Idempotency Guard, Value Objects, Ports).
  - `src/features/<domain>/`: Subdomain grouping with an explicit umbrella module (e.g. `catalog.module.ts`, `alerts.module.ts`).
  - `src/features/<domain>/<slice>/`: Fully self-contained slices.
  - `src/app.module.ts`: Statically imports `SharedModule` and the subdomain modules. No runtime glob scanning.
  - **Server Port:** Binds to `process.env.PORT || 3333` by default. Swagger UI at `/api/docs`.
- **Dependency Rules:**
  - **Zero Cross-Slice Imports:** `features/domain-a/slice-1` MUST NEVER import from `features/domain-b/slice-2`. Communication occurs exclusively via **NATS JetStream events** or direct database queries within its own handler.
  - **Unidirectional:** `src/shared/` MUST NEVER import from `src/features/`.
  - **Enforcement:** Governed by `.dependency-cruiser.cjs` (`pnpm depcruise`). Any cross-slice import breaks the build.

---

## 2. Slice Anatomy

Every vertical slice must adhere strictly to one of three standardized archetypes:

### 2.1 HTTP Command / Query Slice
- `<slice>.dto.ts`: Zod schema and inferred TypeScript types using `nestjs-zod`.
- `<slice>.endpoint.ts`: NestJS `@Controller` exposing the route. Handles HTTP status codes and RFC 7807 Problem Details.
- `<slice>.handler.ts`: Application logic and direct Drizzle SQL queries. Returns `Result<T, DomainError>`. No generic repositories.
- `<slice>.module.ts`: NestJS `@Module` declaring the controller and handler.
- `<slice>.integration.spec.ts`: Vitest integration test against real Docker infrastructure.

### 2.2 Event Consumer Slice (NATS JetStream)
- `<slice>.consumer.ts`: JetStream listener subscribed to durable pull consumer with Dead-Letter handling (`MaxDeliver: 5`, `AckWait: 60s`).
- `<slice>.handler.ts`: Business logic wrapped in `IdempotencyGuard` backed by `processed_events`. Enforces 24h notification cooldown and dispatches emails in concurrent chunks.
- `<slice>.module.ts`: NestJS `@Module` registering the consumer.
- `<slice>.integration.spec.ts`: Vitest test publishing real event to NATS and asserting effects.

### 2.3 Background Job Slice (BullMQ / Valkey)
- `<slice>.processor.ts`: BullMQ Worker with concurrency and rate limiting per domain. Handles distributed repeatable jobs.
- `<slice>.handler.ts`: Task execution via secondary ports (e.g. `ScraperPort`).
- `<slice>.module.ts`: NestJS `@Module` binding the queue.
- `<slice>.integration.spec.ts`: Vitest test asserting job completion and error retries.

---

## 3. Engineering & Code Quality Standards

1. **Test-Driven Development (TDD):**
   - Always write the test first (`*.spec.ts` or `*.integration.spec.ts`) and observe RED before writing production code.
   - Implement the minimum code to turn GREEN, then refactor.
2. **Database Migrations & Test Isolation:**
   - Drizzle migrations run programmatically once via `tests/global-setup.ts` before integration suites start.
   - Clean tables in `beforeEach` and purge NATS JetStream stream (`jsm.streams.purge('PRICEPULSE')`) to prevent test cross-contamination.
3. **Defensive Design & Security:**
   - **URL Normalization:** URLs must be parsed through the `TrackedUrl` Value Object (stripping UTM params, fragments, trailing slashes).
   - **Anti-SSRF with Redirect Validation:** All URL inputs and subsequent HTTP 301/302 `Location` redirects must pass DNS pre-resolution checking against private/loopback CIDRs before HTTP requests.
   - **Rate Limiting:** Protect public endpoints using Valkey sliding-window guards.
4. **Data Integrity & Notification Cooldown:**
   - `user_alerts` enforces uniqueness on `(user_email, product_id)` where `is_active = true`.
   - Prevent notification fatigue: only re-notify if 24 hours have passed or if the price drops lower than the last notified price.
5. **Transactional Outbox with Exponential Backoff:**
   - Any database mutation that generates a domain event MUST insert the event into `outbox_events` in the **same ACID transaction**.
   - Outbox Relay executes non-blocking polling (`SKIP LOCKED`) and handles transient network errors using `next_retry_at` with exponential backoff before declaring `FAILED`.
   - Dual-write (e.g. `db.insert(...)` followed by `nats.publish(...)` without outbox) is strictly forbidden.
6. **Consumer Idempotency:**
   - Every event consumer must execute atomic deduplication in `processed_events` before executing side effects.
7. **No `any` & No `console.log`:**
   - Strict TypeScript (`noImplicitAny`, strict null checks).
   - Use structured logging with contextual `traceId` and OpenTelemetry tracing.
8. **Value Objects & Minor Units (ISO 4217):**
   - Use `Money` Value Object for all prices. Strictly require `amount > 0`. Store amounts in minor units (`current_price_minor_units`, `price_minor_units`). Never use raw floating-point numbers.

---

## 4. Explicit Non-Goals (Out of Scope)

Agents must refuse to introduce or design for:
1. **Traditional Auth / JWT:** Do not create user accounts, passwords, JWT tokens, or auth tables. The app is Guest-First.
2. **Heavy Microservices / Kubernetes:** Do not split into multi-repo or multi-service deployments. This is a Modular Monolith.
3. **Headless Browsers (Puppeteer/Playwright):** Do not add Chromium or browser dependencies. Scraping uses HTTP fetch + Cheerio + JSON-LD.
4. **Payments & Checkout:** Do not add payment gateways (Stripe/PayPal). The app monitors external prices only.
5. **WebSockets / Push Notifications:** Notification delivery is strictly asynchronous via email (Mailpit in dev).
6. **Multi-Tenancy:** No tenant IDs or tenant separation in tables.

---

## 5. Git Worktree Protocol

To prevent cross-contamination and git merge conflicts when developing slices:
1. **Location:** Isolated `.worktrees/<slice-name>` (ignored in `.gitignore`).
2. **Branch Naming:** `feature/<subdomain>-<slice-name>` (e.g. `feature/catalog-register-tracked-url`).
3. **Creation:**
   ```bash
   git worktree add .worktrees/<slice-name> -b feature/<subdomain>-<slice-name> main
   ```
4. **Isolated Work:** Agent edits ONLY files in `src/features/<subdomain>/<slice-name>/`.
5. **Verification:** Run `pnpm test` and `pnpm depcruise` inside the worktree.
6. **Cleanup:** After merging to `main`, remove both the worktree and the feature branch:
   ```bash
   git worktree remove .worktrees/<slice-name>
   git branch -d feature/<subdomain>-<slice-name>
   ```

---

## 6. Reference Template (The Golden Slice)

Before creating any new slice, inspect and follow:
`src/features/_template/health-check/`
This Golden Slice represents the canonical reference implementation of modules, handlers, DTOs, and Vitest integration testing against real Postgres, Valkey, and NATS.
