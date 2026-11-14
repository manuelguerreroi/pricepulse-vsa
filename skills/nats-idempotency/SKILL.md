---
name: nats-idempotency-guidelines
description: "Trigger: nats consumer, jetstream event, idempotency, event deduplication, consumer handler. Guide idempotent NATS JetStream consumer creation."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract
Use when implementing or testing NATS JetStream event consumers in `src/features/**`.

## Hard Rules
1. **Naming Conventions:**
   - Stream: `PRICEPULSE`.
   - Subject format: `pricepulse.v1.events.<domain>.<event-name>`.
   - Dead-Letter format: `pricepulse.v1.deadletter.<domain>`.
2. **Standard Event Envelope:** Every event consumed must conform to `EventEnvelope<T>` containing `id`, `eventType`, `traceId`, `occurredAt`, and `payload`.
3. **Atomic Idempotency Deduplication:**
   Before executing side effects, insert into `processed_events`:
   ```typescript
   const inserted = await db
     .insert(processedEvents)
     .values({ eventId: event.id, consumerName: CONSUMER_NAME })
     .onConflictDoNothing()
     .returning();

   if (inserted.length === 0) {
     msg.ack();
     return; // Already processed
   }
   ```
4. **Notification Fatigue Cooldown:**
   In notification consumers, only dispatch emails if `lastNotifiedAt` was >24 hours ago OR if the new price dropped lower than `lastNotifiedPriceMinorUnits`. Update `lastNotifiedAt` on dispatch.
5. **Durable Pull Consumers & DLQ:** Configure consumers with explicit durable names, `AckExplicit`, and `MaxDeliver: 5`. Messages exceeding delivery attempts route to dead-letter subject.

## Verification Gate
Test the consumer with duplicate delivery and cooldown:
- Send identical event twice; assert side effect executes exactly once.
- Send second drop within 24h at same price; assert email is suppressed by cooldown.
