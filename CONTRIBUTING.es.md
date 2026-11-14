# Guía para Contribuir a PricePulse

¡Gracias por tu interés en contribuir a **PricePulse**! Esta guía detalla nuestro flujo de trabajo de ingeniería, restricciones arquitectónicas y protocolos de contribución.

<p align="center">
  <strong>🌐 Idioma / Language:</strong> <a href="./CONTRIBUTING.md">English</a> | <strong>Español</strong>
</p>

---

## 🏛️ Principios Rectores de Arquitectura

Antes de escribir código, asegúrate de comprender nuestros principios fundamentales de diseño:

1. **Vertical Slice Architecture (VSA):**
   - Cada caso de uso es un slice vertical aislado bajo `src/features/<subdominio>/<nombre-slice>/`.
   - **Cero Imports Cruzados entre Slices:** Un slice NUNCA debe importar código de otro slice. Cualquier import cruzado será bloqueado por `.dependency-cruiser.cjs`.
   - **Sin Repositorios Genéricos:** Los slices ejecutan consultas SQL de Drizzle directamente dentro de `<nombre-slice>.handler.ts`.
2. **Desarrollo Guiado por Pruebas (TDD):**
   - Escribe siempre las pruebas primero (`*.spec.ts` o `*.integration.spec.ts`) y observa que fallen (RED) antes de implementar el código de producción (GREEN).
3. **Seguridad Defensiva y Resiliencia:**
   - Usa siempre el Value Object `Money` para montos monetarios (unidades menores).
   - Valida siempre las URLs externas con `validateUrlSafety` (Anti-SSRF).
   - Cualquier mutación de base de datos que genere un evento DEBE insertar en `outbox_events` dentro de la **misma transacción ACID**.
4. **Respeto a los Non-Goals Explícitos:**
   - No introduzcas autenticación tradicional con JWT/password, mallas de microservicios pesadas, pasarelas de pago ni navegadores headless pesados. Consulta [SEED.md](./SEED.md) para más detalles.

---

## 🌿 Protocolo de Git Worktrees (Obligatorio para Features)

Para mantener aislamiento absoluto y evitar conflictos de merge, cada nuevo slice o funcionalidad se desarrolla en un **Git Worktree** dedicado:

### 1. Crear un Worktree Aislado
```bash
git worktree add .worktrees/<nombre-slice> -b feature/<subdominio>-<nombre-slice> main
```

### 2. Enlazar / Instalar Dependencias
```bash
cd .worktrees/<nombre-slice>
pnpm install
```

### 3. Implementar dentro de Alcance Estricto
- Modifica **ÚNICAMENTE** los archivos de tu slice asignado:
  `src/features/<subdominio>/<nombre-slice>/`
- Respeta la anatomía estandarizada del slice:
  - `<nombre>.dto.ts` (Esquema Zod)
  - `<nombre>.endpoint.ts` / `<nombre>.consumer.ts`
  - `<nombre>.handler.ts` (Lógica de aplicación retornando `Result<T, E>`)
  - `<nombre>.module.ts`
  - `<nombre>.integration.spec.ts` (Suite Vitest contra Docker)

### 4. Ejecutar la Verificación Pre-Merge
Dentro del worktree, corre las tres compuertas de calidad:
```bash
# Pruebas unitarias
pnpm test

# Pruebas de integración
pnpm test:integration

# Linter de gobernanza de arquitectura
pnpm depcruise
```
Todas las comprobaciones deben pasar con cero errores y cero violaciones de dependencias.

### 5. Fusión y Limpieza Completa (Worktree + Branch)
Regresa a la raíz del repositorio principal:
```bash
cd ../..

# 1. Fusionar en main mediante fast-forward
git merge feature/<subdominio>-<nombre-slice> --ff-only

# 2. Eliminar el directorio del worktree
git worktree remove --force .worktrees/<nombre-slice>

# 3. Purgar metadatos de worktrees en Git
git worktree prune

# 4. Eliminar la rama local ya integrada
git branch -d feature/<subdominio>-<nombre-slice>
```

---

## 📝 Convención de Commits

Seguimos la especificación de [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):

- `feat(catalog): ...` — Nuevo slice vertical o funcionalidad importante.
- `fix(security): ...` — Corrección de error o vulnerabilidad.
- `test(alerts): ...` — Suite de pruebas nueva o mejorada.
- `docs: ...` — Actualizaciones en la documentación.
- `refactor: ...` — Mejora interna de código sin cambio funcional.

---

## 🛠️ Verificación del Entorno Local

Asegúrate de que los contenedores de Docker estén corriendo antes de ejecutar las pruebas de integración:
```bash
pnpm docker:up
pnpm db:migrate
```

Interfaces interactivas para depuración:
- **Swagger UI:** [http://localhost:3333/api/docs](http://localhost:3333/api/docs)
- **Mailpit:** [http://localhost:8025](http://localhost:8025)
- **Jaeger:** [http://localhost:16686](http://localhost:16686)
- **NATS:** [http://localhost:8222](http://localhost:8222)
