# Registro de Cambios (Changelog)

Todos los cambios notables del proyecto PricePulse serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

<p align="center">
  <strong>🌐 Idioma / Language:</strong> <a href="./CHANGELOG.md">English</a> | <strong>Español</strong>
</p>

---

## [1.1.0] - 2026-11-14

### Añadido
- **Observabilidad Unificada con Grafana y Prometheus:**
  - Integración de `prom-client` en `MetricsService` exponiendo métricas estándar en `GET /metrics`.
  - Configuración del servidor Prometheus en Docker en el puerto `9090` recolectando métricas cada 5 segundos.
  - Aprovisionamiento automático de Grafana en el puerto `3100` (`pricepulse-dashboard.json`) unificando métricas de Prometheus, trazas de Jaeger y datos relacionales de PostgreSQL con acceso de administrador sin fricción.
- **Pipeline de Integración Continua (CI/CD):**
  - Workflow de GitHub Actions (`.github/workflows/ci.yml`) ejecutando Docker Compose, migraciones de base de datos, pruebas unitarias, pruebas de integración reales, linter de arquitectura y compilación de producción en cada push y PR.
- **Slice de Desuscripción con 1 Clic:**
  - Implementación del slice `alerts/unsubscribe-user-alert` (`GET /api/alerts/unsubscribe?alertId=...`) con desactivación atómica idempotente y respuestas RFC 7807.
  - Se añadieron 3 pruebas de integración elevando el total a 24 pruebas de integración reales sobre 7 suites de prueba.
- **Colección Automatizada de Postman:**
  - Colección E2E de 5 pasos en `tests/postman/pricepulse.postman_collection.json` con scripts de aserción automáticos.
- **Documentación Swagger Enriquecida:**
  - Aplicación de `patchNestJsSwagger()` de `nestjs-zod` en `main.ts`.
  - Enriquecimiento de esquemas Zod con descripciones detalladas y ejemplos reales listos para probar (`@ApiBody`).

## [1.0.0] - 2026-11-13

### Añadido
- **Arquitectura Base:**
  - Implementación estricta de **Vertical Slice Architecture (VSA)** en NestJS con cero dependencias cruzadas entre slices.
  - Gobernanza arquitectónica automatizada mediante `.dependency-cruiser.cjs` en el pipeline de build.
  - Golden Slice ejecutable (`src/features/_template/health-check/`) con sondas de `/health/liveness` y `/health/readiness`.
- **Kernel Compartido (`src/shared/`):**
  - Value Object inmutable `Money` con soporte de unidades menores ISO 4217 y factores de escala (`CLP`, `USD`).
  - Value Object `TrackedUrl` con normalización determinista de URLs de e-commerce y purga de parámetros UTM y hashes.
  - Patrón funcional `Result<T, E>` para control de errores de dominio fuertemente tipados.
  - Validador Anti-SSRF (`validateUrlSafety`) con inspección recursiva de saltos DNS y redirecciones HTTP contra rangos privados y metadatos de Cloud.
- **Persistencia y Datos:**
  - Esquema centralizado de Drizzle ORM sobre PostgreSQL 16.
  - Índices compuestos optimizados en `price_snapshots (product_id, recorded_at desc)`.
  - Índice condicional único en `user_alerts (user_email, product_id) WHERE is_active = true`.
  - Ejecutor programático de migraciones en `tests/global-setup.ts`.
- **Resiliencia Basada en Eventos:**
  - Patrón Transactional Outbox para persistir eventos de forma atómica junto con las entidades de negocio (sin dual-write).
  - Servicio `OutboxRelayService` con bucle periódico que consulta eventos pendientes con `SELECT ... FOR UPDATE SKIP LOCKED` y publica a NATS JetStream con retroceso exponencial.
  - Guard de idempotencia en consumidores respaldado por `processed_events (event_id, consumer_name)` garantizando procesamiento *effectively-once*.
- **Slices de Negocio:**
  - `catalog/register-tracked-url`: Normalización de URL, validación Anti-SSRF, snapshot inicial y emisión atómica de evento al Outbox.
  - `alerts/create-user-alert`: Suscripción a alertas de precio con unicidad de alerta activa y validación de precio objetivo.
  - `ingestion/record-price-snapshot`: Actualización de precio de mercado, historial de snapshots y emisión condicional de `PriceDroppedEventV1` al Outbox.
  - `scraping/schedule-url-scrape`: Worker de BullMQ sobre Valkey con limitación de tasa (2 req/s) y tareas repetitivas cada 4 horas.
  - `notifications/notify-price-drop`: Consumidor NATS JetStream con cooldown de 24 horas y despacho concurrente de correos HTML vía Mailpit.
- **Infraestructura y Herramientas:**
  - `docker-compose.yml` orquestando PostgreSQL 16, Valkey 8, NATS 2.10 JetStream, Mailpit y Jaeger All-in-One.
  - Suites completas en Vitest (16 pruebas unitarias, 21 pruebas de integración contra contenedores Docker reales).
  - SDK de OpenTelemetry integrado con propagación W3C TraceContext.
  - Documentación interactiva Swagger UI en `/api/docs` en el puerto 3333.
  - Protocolo formal de Git Worktrees documentado en `skills/git-worktrees/SKILL.md`.
