---
name: vitest-testing-guidelines
description: "Trigger: test slice, integration test, vitest, spec test, tdd red green, e2e test. Guide Vitest testing standards against real Docker containers."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract
Use when writing unit tests (`*.spec.ts`) or integration tests (`*.integration.spec.ts`) with Vitest in PricePulse.

## Hard Rules
1. **TDD Lifecycle:** Write the failing test first (RED), observe failure, implement minimal code (GREEN), then refactor.
2. **Global Database Setup:** `tests/global-setup.ts` programmatically executes Drizzle migrations against PostgreSQL once before any integration suite runs.
3. **Test Separation:**
   - `*.spec.ts`: Pure unit tests. No network, no database, sub-second execution. Target: Value Objects (`Money`), Anti-SSRF validator, Zod schemas.
   - `*.integration.spec.ts`: Integration tests against real PostgreSQL, Valkey, NATS, and Mailpit in Docker.
4. **State & Stream Isolation:**
   - Truncate affected database tables in `beforeEach` to prevent test contamination.
   - Purge NATS JetStream stream in `beforeEach` (`jsm.streams.purge('PRICEPULSE')`) for event consumer tests.
   - Never mock Drizzle or SQL queries in integration tests. Test real database execution.
5. **Scraping Determinism:**
   - In integration tests, configure `ScraperPort` to use `MockE2EShopAdapter`. Never perform external HTTP requests in automated tests.
6. **Coverage Targets:**
   - `shared/domain`: >95% statement and branch coverage.
   - Feature slices: >80% coverage on handlers and endpoints.

## Verification Gate
Run suite before committing:
```bash
pnpm test
pnpm test:integration
```
All assertions must pass with zero flakes.
