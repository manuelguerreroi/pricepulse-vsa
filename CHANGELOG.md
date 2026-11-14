# Changelog

All notable changes to the PricePulse project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
