---
name: drizzle-outbox-guidelines
description: "Trigger: drizzle query, outbox event, transactional outbox, database transaction, db mutation. Guide atomic Drizzle transactions and outbox events."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract
Use when writing database mutations that emit domain events or querying PostgreSQL with Drizzle in PricePulse.

## Hard Rules
1. **Schema Centralization:** All tables must be declared in `src/shared/infra/database/schema.ts`. Slices import tables from `@shared/infra/database/schema`, never redefine them.
2. **Encapsulated Queries:** Queries live in `<slice>.handler.ts`. No generic repository layers.
3. **Atomic Outbox Mutation:** Any state mutation that produces an event MUST insert into `outbox_events` in the **same ACID transaction**:
   ```typescript
   await db.transaction(async (tx) => {
     await tx.insert(trackedProducts).values({ ... });
     await tx.insert(outboxEvents).values({
       eventType: 'ProductRegisteredEventV1',
       payload: { ... },
       traceId: correlationId,
       status: 'PENDING',
     });
   });
   ```
4. **No Direct Event Publishing from HTTP Handlers:** Never publish directly to NATS from a controller or mutation handler. The `OutboxRelay` background worker alone publishes to NATS.
5. **Money in Minor Units (ISO 4217):** Prices must always be stored in minor units (`bigint` mode `number`, e.g. `current_price_minor_units`) using the `Money` Value Object. Never store floating point numbers.
6. **Exponential Backoff:** The Outbox Relay queries events where `status = 'PENDING'` and `next_retry_at <= NOW()` using `FOR UPDATE SKIP LOCKED`. Transient publish failures increment `attempts` and set `next_retry_at` with exponential backoff before failing.

## Verification Gate
Verify in tests that:
- Transaction rollbacks prevent both the business entity AND the outbox event from persisting.
- The `outbox_events` entry contains valid JSON payload, matching `traceId`, and nullable `nextRetryAt`.
