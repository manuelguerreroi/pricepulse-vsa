# Changelog

All notable changes to the PricePulse project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-11-14

### Added
- **Unified Observability with Grafana & Prometheus:**
  - Integrated `prom-client` in `MetricsService` exposing standard Prometheus metrics via `GET /metrics`.
  - Configured Prometheus server in Docker on port `9090` scraping the API every 5 seconds.
  - Added pre-provisioned Grafana on port `3100` (`pricepulse-dashboard.json`) unifying Prometheus metrics, Jaeger traces, and PostgreSQL business data with anonymous Admin access.
- **Continuous Integration Pipeline:**
  - Configured GitHub Actions workflow (`.github/workflows/ci.yml`) running Docker Compose, database migrations, unit tests, container integration tests, architecture linter, and production build on every push and PR.
- **One-Click Unsubscribe Slice:**
  - Implemented `alerts/unsubscribe-user-alert` slice (`GET /api/alerts/unsubscribe?alertId=...`) with idempotent deactivation and RFC 7807 problem details.
  - Added 3 integration tests bringing the total to 24 integration tests across 7 test suites.
- **Testing & Postman Collection:**
  - Added automated 5-step E2E Postman collection (`tests/postman/pricepulse.postman_collection.json`) with assertion scripts.
- **Swagger Documentation:**
  - Applied `patchNestJsSwagger()` from `nestjs-zod` in `main.ts`.
  - Enriched all Zod schemas with `.describe()` and `@ApiBody` examples.

## [1.0.0] - 2026-11-13

### Added
- **Core Architecture:**
  - Implemented strict **Vertical Slice Architecture (VSA)** in NestJS with zero cross-slice imports.
  - Enforced architecture rules via `.dependency-cruiser.cjs` with automated build checks.
  - Provided Golden Slice template (`src/features/_template/health-check/`) with `/health/liveness` and `/health/readiness` probes.
- **Shared Kernel:**
  - Value Object `Money` supporting ISO 4217 minor units and scale factors (`CLP`, `USD`).
  - Value Object `TrackedUrl` normalizing e-commerce URLs by stripping UTM parameters, fragments, and trailing slashes.
  - Functional `Result<T, E>` pattern for type-safe domain error handling.
  - Anti-SSRF validator (`validateUrlSafety`) with recursive DNS redirect inspection against private/loopback CIDRs.
- **Data & Persistence:**
  - Centralized Drizzle ORM schema with PostgreSQL 16 driver.
  - Optimized composite indexes on `price_snapshots (product_id, recorded_at desc)`.
  - Conditional unique index on `user_alerts (user_email, product_id) WHERE is_active = true`.
  - Programmatic migration runner in `tests/global-setup.ts`.
- **Event-Driven Resilience:**
  - Transactional Outbox pattern persisting events atomically with business entities.
  - `OutboxRelayService` polling pending events with `SELECT ... FOR UPDATE SKIP LOCKED` and publishing to NATS JetStream with exponential backoff.
  - Idempotency guard in consumers backed by `processed_events (event_id, consumer_name)` ensuring effectively-once processing.
- **Feature Slices:**
  - `catalog/register-tracked-url`: URL normalization, anti-SSRF validation, initial snapshot, and atomic outbox event emission.
  - `alerts/create-user-alert`: User alert subscription with active alert uniqueness and target price validation.
  - `ingestion/record-price-snapshot`: Dynamic price update, snapshot history, and conditional `PriceDroppedEventV1` outbox emission.
  - `scraping/schedule-url-scrape`: BullMQ queue worker on Valkey with domain rate limiting (2 req/s) and repeatable jobs every 4 hours.
  - `notifications/notify-price-drop`: NATS JetStream consumer with 24h notification cooldown and batch HTML email dispatch via Mailpit.
- **Infrastructure & Tooling:**
  - `docker-compose.yml` orchestrating PostgreSQL 16, Valkey 8, NATS 2.10 JetStream, Mailpit, and Jaeger All-in-One.
  - Vitest test suites (16 unit tests, 21 integration tests against real Docker containers).
  - OpenTelemetry SDK integration with W3C TraceContext propagation.
  - Interactive Swagger UI documentation at `/api/docs` on port 3333.
  - Git Worktree workflow formalization in `skills/git-worktrees/SKILL.md`.
