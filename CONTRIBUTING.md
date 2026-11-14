# Contributing to PricePulse

<p align="center">
  <strong>🌐 Language / Idioma:</strong> <strong>English</strong> | <a href="./CONTRIBUTING.es.md">Español</a>
</p>

Thank you for your interest in contributing to **PricePulse**! This guide outlines our engineering workflow, architectural constraints, and contribution protocols.

---

## 🏛️ Guiding Architectural Principles

Before writing any code, ensure you understand our core design principles:

1. **Vertical Slice Architecture (VSA):**
   - Each use case is an isolated vertical slice under `src/features/<subdomain>/<slice-name>/`.
   - **Zero Cross-Slice Imports:** A slice MUST NEVER import code from another slice. Any cross-import will be blocked by `.dependency-cruiser.cjs`.
   - **No Generic Repositories:** Slices execute Drizzle SQL queries directly inside `<slice>.handler.ts`.
2. **Test-Driven Development (TDD):**
   - Always write tests first (`*.spec.ts` or `*.integration.spec.ts`) and observe RED before writing production code.
3. **Defense in Depth & Resilience:**
   - Always use the `Money` Value Object for monetary amounts.
   - Always validate external URLs with `validateUrlSafety` (Anti-SSRF).
   - Any database mutation that produces an event MUST insert into `outbox_events` in the **same ACID transaction**.
4. **Respect Explicit Non-Goals:**
   - Do not introduce traditional JWT/password authentication, heavy microservices, payment gateways, or headless browser dependencies. Review [SEED.md](./SEED.md) for details.

---

## 🌿 Git Worktree Workflow (Mandatory for Features)

To maintain complete isolation and avoid merge conflicts, every new slice or feature is developed in a dedicated **Git Worktree**:

### 1. Create an Isolated Worktree
```bash
git worktree add .worktrees/<slice-name> -b feature/<subdomain>-<slice-name> main
```

### 2. Install / Link Dependencies
```bash
cd .worktrees/<slice-name>
pnpm install
```

### 3. Implement within Narrow Scope
- Touch **ONLY** files inside your assigned slice:
  `src/features/<subdomain>/<slice-name>/`
- Follow the standardized slice archetype:
  - `<name>.dto.ts` (Zod schema)
  - `<name>.endpoint.ts` / `<name>.consumer.ts`
  - `<name>.handler.ts` (Application logic returning `Result<T, E>`)
  - `<name>.module.ts`
  - `<name>.integration.spec.ts` (Vitest test against Docker)

### 4. Run Pre-Merge Verification
Inside the worktree, run the three verification gates:
```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# Architecture governance linter
pnpm depcruise
```
All checks must pass with zero errors and zero dependency violations.

### 5. Merge and Clean Up (Worktree + Branch)
Return to the main repository root:
```bash
cd ../..

# 1. Merge into main
git merge feature/<subdomain>-<slice-name> --ff-only

# 2. Remove the worktree directory
git worktree remove --force .worktrees/<slice-name>

# 3. Prune worktree metadata
git worktree prune

# 4. Delete the merged feature branch
git branch -d feature/<subdomain>-<slice-name>
```

---

## 📝 Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat(catalog): ...` — New vertical slice or major capability.
- `fix(security): ...` — Bug fix or vulnerability resolution.
- `test(alerts): ...` — New or improved test suite.
- `docs: ...` — Documentation updates.
- `refactor: ...` — Code improvement without functional change.

---

## 🛠️ Local Environment Checklist

Ensure your local environment has the Docker containers running before executing integration tests:
```bash
pnpm docker:up
pnpm db:migrate
```

Interactive debug interfaces:
- **Swagger UI:** [http://localhost:3333/api/docs](http://localhost:3333/api/docs)
- **Mailpit:** [http://localhost:8025](http://localhost:8025)
- **Jaeger:** [http://localhost:16686](http://localhost:16686)
- **NATS:** [http://localhost:8222](http://localhost:8222)
