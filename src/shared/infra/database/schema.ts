import { pgTable, uuid, text, varchar, bigint, timestamp, boolean, integer, jsonb, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Catálogo de productos monitoreados
export const trackedProducts = pgTable('tracked_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  url: text('url').notNull().unique(), // URL normalizada (sin UTMs ni hashes)
  domain: varchar('domain', { length: 128 }).notNull(),
  title: text('title').notNull(),
  currentPriceMinorUnits: bigint('current_price_minor_units', { mode: 'number' }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('CLP'),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'), // ACTIVE, OUT_OF_STOCK, INACTIVE
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Histórico de snapshots de precios
export const priceSnapshots = pgTable('price_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => trackedProducts.id, { onDelete: 'cascade' }),
  priceMinorUnits: bigint('price_minor_units', { mode: 'number' }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('CLP'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  productRecordedIdx: index('idx_price_snapshots_product_recorded').on(table.productId, table.recordedAt.desc()),
}));

// 3. Suscripciones de usuarios a alertas de precio
export const userAlerts = pgTable('user_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userEmail: text('user_email').notNull(),
  productId: uuid('product_id').notNull().references(() => trackedProducts.id, { onDelete: 'cascade' }),
  targetPriceMinorUnits: bigint('target_price_minor_units', { mode: 'number' }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }),
  lastNotifiedPriceMinorUnits: bigint('last_notified_price_minor_units', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  productActiveIdx: index('idx_user_alerts_product_active').on(table.productId, table.isActive),
  userProductActiveUnique: uniqueIndex('idx_user_alerts_user_product_active').on(table.userEmail, table.productId).where(sql`is_active = true`),
}));

// 4. Transactional Outbox (Garantía de publicación de eventos sin dual-write)
export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventType: varchar('event_type', { length: 128 }).notNull(),
  payload: jsonb('payload').notNull(),
  traceId: varchar('trace_id', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('PENDING'), // PENDING, PUBLISHED, FAILED
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => ({
  pendingIdx: index('idx_outbox_events_pending').on(table.status, table.nextRetryAt).where(sql`status = 'PENDING'`),
}));

// 5. Deduplicación e Idempotencia de Consumidores (Effectively-Once)
export const processedEvents = pgTable('processed_events', {
  eventId: uuid('event_id').notNull(),
  consumerName: varchar('consumer_name', { length: 128 }).notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.eventId, table.consumerName] }),
}));
