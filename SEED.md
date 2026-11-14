# SEED.md — PricePulse VSA (Production Architecture Specification)

- **Dominio:** Motor de monitoreo de precios de e-commerce, ingestión distribuida, scraping resiliente y alertas reactivas.
- **Filosofía de Acceso:** *Guest-First / Frictionless* (suscripción directa mediante email sin login con JWT, priorizando el foco en la arquitectura distribuida).
- **Estándar de Ingeniería:** Nivel MAANG (Defensivo, altamente testeable, desacoplado, observable con OpenTelemetry y resiliente a fallos de red/concurrencia).
- **Patrón Arquitectónico:** Vertical Slice Architecture (VSA) estricta, desacoplada mediante Event-Driven Architecture (EDA), Transactional Outbox e Idempotent Consumers.
- **Stack Principal:** NestJS 10+, TypeScript (Strict), Drizzle ORM, PostgreSQL 16, Valkey 8 (BullMQ), NATS 2.10 JetStream (`-js`), OpenTelemetry (OTel), Vitest.
- **Infraestructura Base (`docker-compose.yml`):**
  - PostgreSQL 16-alpine (puerto `5432`, límite `256MB`).
  - Valkey 8-alpine (puerto `6379`, límite `128MB`).
  - NATS 2.10-alpine con `-js` habilitado (puerto `4222`, límite `64MB`).
  - Mailpit (servidor SMTP local; puerto SMTP `1025`, Web UI en `http://localhost:8025`, límite `64MB`).
  - Jaeger All-in-One (Visualizador OpenTelemetry de trazas distribuidas; Web UI en `http://localhost:16686`, límite `128MB`).
  - API NestJS: Puerto `3333` por defecto (Swagger UI en `http://localhost:3333/api/docs`).

---

## 1. Arquitectura y Guardias Inmutables (VSA)

### 1.1 Topología del Repositorio
```
src/
├── shared/                             # Kernel transversal y primitivas de infraestructura
│   ├── domain/                         # Value Objects universales (Money, TrackedUrl, Result/Either)
│   ├── ports/                          # Puertos secundarios desacoplados (ScraperPort, NotificationPort)
│   ├── infra/
│   │   ├── database/                   # Cliente Drizzle, schema maestro y migraciones
│   │   ├── nats/                       # Cliente NATS JetStream, Bootstrap Service y Dead-Letter
│   │   ├── valkey/                     # Conexión Valkey y factory para BullMQ / Rate Limiting
│   │   ├── outbox/                     # Transactional Outbox Publisher y Relay Worker
│   │   ├── idempotency/                # Guard y storage de eventos procesados
│   │   ├── notifications/              # Adaptadores de notificación (Mailpit / Resend) y templates HTML
│   │   ├── observability/              # OpenTelemetry SDK (OTel), Pino Logger estructurado y W3C Tracing
│   │   └── security/                   # Anti-SSRF validator (DNS + Redirects) y RateLimiterGuard
│   └── shared.module.ts                # Módulo global exportando clientes transversales
├── features/                           # Vertical Slices agrupados por subdominio
│   ├── _template/health-check/         # Golden Slice (molde ejecutable: liveness & readiness)
│   ├── catalog/                        # Subdominio de catálogo y productos monitoreados
│   │   ├── register-tracked-url/       # Vertical Slice: Normalización de URL y alta de producto
│   │   └── catalog.module.ts           # Módulo paraguas del subdominio de catálogo
│   ├── alerts/                         # Subdominio de suscripciones y reglas de alerta
│   │   ├── create-user-alert/          # Vertical Slice: Suscripción a alerta (única activa por email)
│   │   └── alerts.module.ts            # Módulo paraguas del subdominio de alertas
│   ├── scraping/                       # Subdominio de extracción con adaptadores y BullMQ
│   │   ├── schedule-url-scrape/        # Vertical Slice: Tareas repetitivas de scraping distribuido
│   │   └── scraping.module.ts          # Módulo paraguas del subdominio de scraping
│   ├── ingestion/                      # Subdominio de ingesta de snapshots y eventos
│   │   ├── record-price-snapshot/      # Vertical Slice: Registro de variación y emisión Outbox
│   │   └── ingestion.module.ts         # Módulo paraguas del subdominio de ingestión
│   └── notifications/                  # Subdominio de despacho reactivo de alertas
│       ├── notify-price-drop/          # Vertical Slice: Consumidor NATS, cooldown 24h y batch emails
│       └── notifications.module.ts     # Módulo paraguas del subdominio de notificaciones
├── app.module.ts                       # Ensamblador estático de SharedModule + Módulos de Subdominio
└── main.ts                             # Bootstrap de NestJS con OpenTelemetry, Graceful Shutdown y Problem Details
```

### 1.2 Reglas Inmutables de Dependencia (`.dependency-cruiser.cjs`)
1. **Zero Cross-Slice Imports:** Ningún archivo bajo `src/features/<dominio>/<slice-a>/` puede importar directa o indirectamente de `src/features/<dominio-b>/<slice-b>/`.
2. **Dirección Unidireccional:** `src/shared/` tiene estrictamente prohibido importar código desde `src/features/`.
3. **Persistencia Encapsulada:** Las consultas SQL (Drizzle queries: `select`, `insert`, `update`) deben residir **exclusivamente dentro del handler del slice** correspondiente. No existen repositorios genéricos compartidos en `shared/`.
4. **Gobernanza Modular Estática:** Cada subdominio exporta un módulo NestJS explícito (`catalog.module.ts`, `alerts.module.ts`, etc.) que registra sus slices hijos. `app.module.ts` importa únicamente los módulos de subdominio, garantizando compilación estática instantánea sin escaneos dinámicos por globs.

### 1.3 Non-Goals (Fuera de Alcance Deliberado)
Para proteger el foco en la excelencia arquitectónica de VSA y evitar sobre-ingeniería innecesaria:
1. **No Autenticación Tradicional con JWT / Passwords:** No se implementan logins, hashes de contraseñas con bcrypt, refresh tokens ni tablas de perfiles de usuario. Se opera bajo el modelo *Guest-First / Email-First* con Rate Limiting distribuido en Valkey.
2. **No Microservicios Distribuidos / Kubernetes:** No se fragmenta la aplicación en múltiples repositorios ni clusters de Kubernetes. Demostramos desacoplamiento real como un **Monolito Modular bajo VSA**.
3. **No Navegadores Headless Pesados en Producción:** El scraping se basa en peticiones HTTP de alta velocidad con `cheerio`, microdatos Schema.org (`application/ld+json`) y `MockE2EShopAdapter`. No se ejecutan clusters de Chromium (Puppeteer/Playwright).
4. **No Pasarelas de Pago ni Checkout (Stripe / PayPal):** PricePulse es un motor de monitoreo y alertas; no es un e-commerce que procese cobros ni transacciones financieras.
5. **No Servidor de WebSockets ni Push Notifications Móviles:** La entrega de alertas se realiza exclusivamente vía asíncrona por correo electrónico (Mailpit en desarrollo / SMTP o Resend en producción).
6. **No Multi-Tenancy Empresarial:** No se implementa particionado de bases de datos por organizaciones o tenants.

### 1.4 Protocolo Operativo de Git Worktrees
Cada vertical slice se desarrolla en un worktree aislado para garantizar cero contaminación cruzada entre ramas o agentes:
1. **Ubicación:** Carpeta `.worktrees/` en la raíz del repositorio (ignorada en `.gitignore`).
2. **Nomenclatura de Ramas:** `feature/<subdominio>-<nombre-slice>` (ej. `feature/catalog-register-tracked-url`).
3. **Creación del Worktree:**
   ```bash
   git worktree add .worktrees/<nombre-slice> -b feature/<subdominio>-<nombre-slice> main
   ```
4. **Desarrollo Aislado:** El agente o desarrollador trabaja dentro de `.worktrees/<nombre-slice>/`, editando **únicamente** los archivos bajo `src/features/<dominio>/<nombre-slice>/`.
5. **Verificación Local:** Se ejecutan las pruebas y la auditoría de dependencias dentro del worktree:
   ```bash
   pnpm test
   pnpm depcruise
   ```
6. **Fusión y Limpieza Completa (Worktree + Branch):**
   Tras fusionar los cambios en `main` mediante Pull Request o Merge:
   ```bash
   # 1. Eliminar el worktree del disco y del registro de Git
   git worktree remove .worktrees/<nombre-slice>

   # 2. Eliminar la rama de la feature ya integrada
   git branch -d feature/<subdominio>-<nombre-slice>
   ```

---

## 2. Anatomía Estandarizada de un Vertical Slice

Cada caso de uso es autocontenido y se ajusta a uno de los siguientes tres arquetipos:

### 2.1 Slice de Entrada HTTP (Command / Query)
```
src/features/<dominio>/<nombre-slice>/
├── <nombre-slice>.dto.ts               # Validación de payload/query params con Zod (nestjs-zod)
├── <nombre-slice>.endpoint.ts          # Controller NestJS (@Controller, rutas HTTP)
├── <nombre-slice>.handler.ts           # Lógica de aplicación, persistencia Drizzle y emisión Outbox
├── <nombre-slice>.module.ts            # Módulo NestJS que declara y provee los componentes del slice
└── <nombre-slice>.integration.spec.ts  # Test de integración con Vitest contra base de datos real
```

### 2.2 Slice Consumidor de Eventos (NATS JetStream Consumer)
```
src/features/<dominio>/<nombre-slice>/
├── <nombre-slice>.consumer.ts          # Listener suscrito al Stream/Subject de NATS JetStream
├── <nombre-slice>.handler.ts           # Lógica de negocio protegida por IdempotencyGuard y Cooldown
├── <nombre-slice>.module.ts            # Módulo NestJS con el registro del consumidor
└── <nombre-slice>.integration.spec.ts  # Test publicando un evento real y verificando efecto en BD
```

### 2.3 Slice Asíncrono de Fondo (BullMQ Job / Worker)
```
src/features/<dominio>/<nombre-slice>/
├── <nombre-slice>.processor.ts         # Worker de BullMQ con rate-limiting y concurrencia por dominio
├── <nombre-slice>.handler.ts           # Orquestación de la tarea (ej. scraping vía ScraperPort)
├── <nombre-slice>.module.ts            # Módulo NestJS con la configuración de la cola
└── <nombre-slice>.integration.spec.ts  # Test encolando un trabajo y validando resultado
```

---

## 3. Modelo de Datos Centralizado (`src/shared/infra/database/schema.ts`)

El esquema de base de datos se centraliza en `src/shared/infra/database/schema.ts` para que `drizzle-kit` genere migraciones deterministas y uniformes:

```typescript
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
```

---

## 4. Topología de Eventos y NATS JetStream

### 4.1 Configuración del Stream y Consumidores
- **Stream Name:** `PRICEPULSE`
- **Subjects:** `pricepulse.v1.events.>`
- **Storage:** File storage persistente.
- **Retention Policy:** `LimitsPolicy` (retención configurable por tiempo y tamaño).
- **Consumer Guarantees:** `AckWait: 60s`, `AckExplicit`, `MaxDeliver: 5`.
- **Dead-Letter Queue (DLQ):** Mensajes que superen 5 reintentos se publican en `pricepulse.v1.deadletter.notifications`.
- **Bootstrap Service (`src/shared/infra/nats/nats-bootstrap.service.ts`):** En `onApplicationBootstrap`, crea o actualiza idempotentemente el Stream en NATS si no existe.

### 4.2 Formato del Event Envelope
Todos los eventos publicados en NATS siguen una estructura inmutable:
```typescript
export interface EventEnvelope<T = unknown> {
  id: string;                       // UUID único del evento (coincide con outboxEvents.id)
  eventType: string;                // Ej: 'PriceDroppedEventV1'
  traceId: string;                  // Correlation ID (W3C TraceContext)
  occurredAt: string;               // ISO-8601 UTC
  payload: T;                       // Datos de negocio fuertemente tipados
}
```

### 4.3 Catálogo de Eventos Iniciales
1. `pricepulse.v1.events.catalog.product-registered`:
   - Payload: `{ productId: string, url: string, domain: string, initialPriceMinorUnits: number, currency: string }`
2. `pricepulse.v1.events.price.dropped`:
   - Payload: `{ productId: string, oldPriceMinorUnits: number, newPriceMinorUnits: number, dropPercentage: number, currency: string, snapshotId: string }`

---

## 5. Primitivas de Resiliencia, Seguridad, Observabilidad y Puertos en `src/shared/`

### 5.1 Observabilidad Global con OpenTelemetry (OTel) y Logs Estructurados
- **SDK de OpenTelemetry (`src/shared/infra/observability/telemetry.ts`):**
  - Se inicializa antes del arranque de NestJS en `main.ts`.
  - Instrumenta automáticamente HTTP (Fastify/Express), PostgreSQL (Drizzle) y NATS JetStream.
  - Exporta trazas distribuidas vía OTLP hacia **Jaeger** (`http://localhost:16686` en desarrollo) o hacia stacks LGTM (Grafana Tempo / Loki) en producción.
- **Trazabilidad W3C (`traceparent` / `traceId`):**
  - Cada solicitud HTTP genera o propaga el `traceId`.
  - El `traceId` se guarda en la tabla `outbox_events`.
  - El Outbox Relay lo inyecta en las cabeceras de NATS JetStream (`Nats-Msg-Id` y `traceparent`).
  - El consumidor de NATS lo correlaciona en sus logs estructurados con **Pino**.

### 5.2 Value Objects Inmutables
- **`Money` (`src/shared/domain/money.vo.ts`):**
  - Exige estrictamente `amount > 0` (un precio `<= 0` es considerado inválido o fuera de stock).
  - Almacena montos como enteros en *minor units* según la moneda ISO 4217 (`CLP` factor 1, `USD` factor 100).
- **`TrackedUrl` (`src/shared/domain/tracked-url.vo.ts`):**
  - Normaliza la URL: elimina `utm_*`, `ref`, `fbclid`, `gclid`, hash fragments (`#...`), trailing slashes y pasa el host a minúsculas. Garantiza la unicidad exacta en base de datos.

### 5.3 Transactional Outbox Relay Worker (`src/shared/infra/outbox/outbox-relay.service.ts`)
- Polling concurrente seguro cada 250ms con control de reintentos mediante backoff exponencial:
  ```sql
  SELECT * FROM outbox_events 
  WHERE status = 'PENDING' 
    AND (next_retry_at IS NULL OR next_retry_at <= NOW())
  ORDER BY created_at ASC 
  FOR UPDATE SKIP LOCKED 
  LIMIT 50;
  ```
- Publica hacia NATS JetStream inyectando el `traceId` en las cabeceras del mensaje.
- Con el `ack` de JetStream, actualiza atómicamente a `status = 'PUBLISHED'` y `processedAt = NOW()`.
- Ante fallas transitorias de red, incrementa `attempts`, calcula `next_retry_at = NOW() + (2 ^ attempts * 1000)ms` y, tras 5 intentos fallidos, transiciona a `FAILED`.

### 5.4 Idempotency Guard (`src/shared/infra/idempotency/idempotency.guard.ts`)
- Garantiza procesamiento *effectively-once* ante la semántica *at-least-once* de NATS.
- Inserta atómicamente en `processed_events`:
  ```sql
  INSERT INTO processed_events (event_id, consumer_name, processed_at)
  VALUES ($1, $2, NOW())
  ON CONFLICT (event_id, consumer_name) DO NOTHING;
  ```
- Si no se insertaron filas, emite `msg.ack()` y descarta el mensaje inmediatamente.

### 5.5 Seguridad Defensiva y Protección Anti-SSRF Recursiva (`src/shared/infra/security/ssrf.validator.ts`)
- Valida estrictamente URLs de e-commerce antes de que el motor de scraping haga fetch:
  1. Esquema estricto: solo `http:` o `https:`.
  2. Resolución DNS previa y rechazo terminante de IPs privadas/loopback (`127.0.0.1`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` AWS metadata).
  3. Validación de dominio frente a dominios soportados.
  4. **Protección contra Redirects (301/302):** El cliente de scraping inspecciona cada salto de redirección y valida nuevamente el destino en la cabecera `Location` mediante DNS antes de ejecutar la petición final.

### 5.6 Rate Limiting con Valkey (`src/shared/infra/security/rate-limiter.guard.ts`)
- Sliding window counter en Valkey para proteger la API pública contra abusos (ej. máximo 10 registros por IP cada 15 minutos).

### 5.7 Puertos y Adaptadores Desacoplados (MAANG Extensibility)
- **`ScraperPort` (`src/shared/ports/scraper.port.ts`):**
  - Interfaz: `scrape(url: string): Promise<Result<ScrapedProduct, ScrapingError>>`
  - Adaptadores: `MockE2EShopAdapter`, `SchemaOrgAdapter`, `MercadoLibreAdapter`.
- **`NotificationPort` (`src/shared/ports/notification.port.ts`):**
  - Interfaz: `sendPriceDropAlert(alert: PriceDropAlertData): Promise<Result<void, NotificationError>>`
  - Adaptadores: `MailpitAdapter` (Default en dev en `http://localhost:8025`), `ResendOrSmtpAdapter`.
  - **Plantilla de Correo:** Diseño HTML limpio y responsivo con:
    - Nombre del producto.
    - Precio anterior tachado vs nuevo precio en oferta.
    - Badge con porcentaje de ahorro (ej. `¡Bajó un 25%!`).
    - Botón de compra directo a la tienda.
    - Enlace seguro de desuscripción en un clic (`/api/alerts/unsubscribe?id=...`).
  - **Despacho Concurrente en Lotes:** El consumidor envía correos en chunks concurrentes de 5-10 (`Promise.all`) para mantenerse ampliamente dentro del límite de `AckWait: 60s` de NATS.

### 5.8 Graceful Shutdown (`main.ts`)
- Al recibir `SIGTERM` o `SIGINT`:
  1. Cierra la recepción de nuevas conexiones HTTP.
  2. Espera que los workers en ejecución de BullMQ y el ciclo de Outbox Relay finalicen.
  3. Cierra el SDK de OpenTelemetry asegurando el flush de trazas pendientes.
  4. Ejecuta `flush` y desconexión limpia en NATS JetStream.
  5. Cierra el pool de conexiones de PostgreSQL en Drizzle.

---

## 6. Golden Slice: `src/features/_template/health-check/`

El Golden Slice es el arquetipo de referencia y prueba viva de la arquitectura:
- **`health-check.dto.ts`:** Esquema Zod de validación.
- **`health-check.endpoint.ts`:**
  - `@Get('/health/liveness')`: Retorna 200 `{ status: 'alive' }` si el proceso Node responde.
  - `@Get('/health/readiness')`: Retorna 200 `{ status: 'ready', checks: { postgres: 'ok', valkey: 'ok', nats: 'ok' } }` solo si los 3 servicios responden.
- **`health-check.handler.ts`:** Ejecuta un ping coordinado hacia PostgreSQL, Valkey y NATS JetStream.
- **`health-check.module.ts`:** Registrado en el módulo de salud e importado en `AppModule`.
- **`health-check.integration.spec.ts`:** Test con Vitest que valida las respuestas HTTP 200 contra los contenedores reales.

---

## 7. Catálogo de Slices Iniciales (Fase Post-Skeleton)

| Slice | Subdominio | Tipo | Responsabilidad y Flujo |
|---|---|---|---|
| `catalog/register-tracked-url` | Catálogo | HTTP Command | Normaliza URL (elimina UTMs), valida con Anti-SSRF (incluyendo redirects), extrae precio inicial (vía `ScraperPort`), persiste producto y snapshot en transacción atómica con Outbox (`ProductRegisteredEventV1`), y programa trabajo repetitivo en BullMQ. |
| `alerts/create-user-alert` | Alertas | HTTP Command | Valida email y precio objetivo con Zod; vincula la alerta activa al `productId` garantizando una sola alerta activa por usuario mediante índice único. |
| `scraping/schedule-url-scrape` | Scraping | BullMQ Job | Tarea repetitiva distribuida (`repeat: { every: 14400000 }` cada 4h) con limitación de concurrencia y rate-limit por dominio en Valkey; si el producto devuelve 404 continuo, transiciona a `INACTIVE`. Pasa resultado a ingestión. |
| `ingestion/record-price-snapshot` | Ingestión | Command / Internal | Registra nuevo snapshot; actualiza siempre `currentPriceMinorUnits` en `tracked_products`; y solo si `newPrice < oldPrice`, emite `PriceDroppedEventV1` al Outbox. |
| `notifications/notify-price-drop` | Notificaciones | NATS Consumer | Consumidor idempotente de `PriceDroppedEventV1` con `AckWait: 60s`. Consulta alertas activas cuyo `targetPriceMinorUnits >= newPriceMinorUnits` y verifica cooldown de 24h. Despacha correos en chunks concurrentes mediante `NotificationPort` (Mailpit) y actualiza `last_notified_at`. |

---

## 8. Estrategia de Testing con Vitest

- **Setup Global (`tests/global-setup.ts`):** Ejecuta programáticamente las migraciones de Drizzle sobre PostgreSQL una sola vez antes de correr las suites de integración.
- **Aislamiento de Mensajes en Tests:** Cada suite de integración de consumidores ejecuta `jsm.streams.purge('PRICEPULSE')` en su ciclo `beforeEach` para garantizar que ningún mensaje residual contamine la prueba.
- **Tests Unitarios (`*.spec.ts`):** Lógica pura sin I/O (Value Objects `Money`, `TrackedUrl`, validadores Zod, parser Anti-SSRF, lógica de cálculo de porcentajes). Objetivo de cobertura: >95%.
- **Tests de Integración (`*.integration.spec.ts`):** Un test de integración por slice ejecutado contra contenedores Docker reales (Postgres, Valkey, NATS, Mailpit).
- **Comandos de Testing:**
  ```bash
  pnpm test               # Ejecuta Vitest en modo unitario
  pnpm test:integration   # Ejecuta las suites de integración contra Docker
  pnpm test:coverage      # Reporte de cobertura estricto con @vitest/coverage-v8
  ```

---

## 9. Comandos Operativos y Entorno de Desarrollo

```bash
# 1. Infraestructura
pnpm docker:up          # Levanta Postgres, Valkey, NATS, Mailpit y Jaeger con docker-compose up -d
pnpm docker:down        # Detiene los contenedores locales

# 2. Base de Datos (Drizzle ORM)
pnpm db:generate        # Genera migraciones SQL a partir de schema.ts
pnpm db:migrate         # Aplica las migraciones pendientes en PostgreSQL
pnpm db:studio          # Abre Drizzle Studio para inspección visual de datos

# 3. Gobernanza Arquitectónica y Testing
pnpm depcruise          # Ejecuta dependency-cruiser para verificar cero imports entre slices
pnpm test               # Ejecuta pruebas con Vitest
pnpm test:integration   # Ejecuta pruebas de integración contra la infraestructura real
```

---

## 10. Showcase y Documentación Pública (GitHub Pages)

- **Ubicación en el repositorio:** Directorio `docs/` (sitio estático ligero desarrollado con VitePress, Starlight o Astro con soporte Mermaid.js / Tailwind).
- **Contenido del Showcase:**
  1. **Explicación Interactiva de VSA:** Comparación conceptual entre arquitectura en capas y Vertical Slice Architecture.
  2. **Diagramas de Flujo y Secuencia (Mermaid.js):**
     - **Ciclo del Transactional Outbox:** Persistencia atómica -> Worker con `SKIP LOCKED` y retroceso exponencial -> Publicación a NATS JetStream.
     - **Flujo de Scraping Asíncrono:** Tareas repetitivas en BullMQ -> Rate limiting por dominio en Valkey -> Ingesta de snapshot.
     - **Deduplicación e Idempotencia:** Consumo en `notifications/notify-price-drop` y descarte mediante `processed_events`.
     - **Observabilidad con OpenTelemetry:** Gráfico de trazas W3C desde HTTP hasta NATS y el despacho de notificaciones.
     - **Seguridad Defensiva:** Diagrama del filtro Anti-SSRF (con validación de redirects) y Rate Limiting.
  3. **Catálogo Vivo de Slices y Contratos de Eventos:** Fichas interactivas con los esquemas de eventos y la anatomía de cada slice.
  4. **Documentación de API y Pruebas:** Guía de ejecución local con Docker Compose en puerto `3333`.
- **Automatización CI/CD:** Workflow en `.github/workflows/deploy-pages.yml` que compila y publica en GitHub Pages en cada merge a `main`.
