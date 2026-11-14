---
name: vsa-slice-guidelines
description: "Trigger: create slice, new slice, vertical slice, VSA, feature slice, slice module. Guide creation and structure of Vertical Slices in NestJS."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract
Use when creating, refactoring, or reviewing any feature slice under `src/features/<domain>/<slice>/`.

## Hard Rules
1. **Zero Cross-Slice Imports:** Never import from another slice directory. Use NATS JetStream events or direct database queries within your slice handler.
2. **No Generic Repositories:** Write Drizzle queries directly inside `<slice>.handler.ts`. Do not abstract queries into shared repositories.
3. **Zod Validation:** Use `nestjs-zod` and `createZodDto` for DTOs. Never use `class-validator` decorators.
4. **Result Pattern:** Handlers must return `Result<T, DomainError>` rather than throwing exceptions for expected business failures.
5. **Subdomain Umbrella Modules:** Every slice declares its own `<slice>.module.ts`. Each subdomain defines an umbrella module (e.g. `catalog.module.ts`, `alerts.module.ts`) importing its slices. `AppModule` statically imports only the subdomain modules (no dynamic globs).

## File Structure per Archetype
- **HTTP Command/Query:**
  - `<name>.dto.ts`: Zod schema (`z.object({...})`) + DTO class.
  - `<name>.endpoint.ts`: NestJS Controller with status codes and Problem Details mapping.
  - `<name>.handler.ts`: Application logic and direct Drizzle SQL queries.
  - `<name>.module.ts`: NestJS `@Module({ controllers: [...], providers: [...] })`.
  - `<name>.integration.spec.ts`: Vitest integration test.
- **Consumer:**
  - `<name>.consumer.ts`: JetStream listener.
  - `<name>.handler.ts`: Idempotent business logic.
  - `<name>.module.ts`: NestJS Module.
  - `<name>.integration.spec.ts`: Vitest test.

## Verification Gate
Before closing any slice task, run:
```bash
pnpm depcruise
pnpm test
```
Both commands must pass with zero violations.
