---
name: git-worktrees-guidelines
description: "Trigger: git worktree, worktree, create worktree, isolated slice development, remove worktree. Guide Git Worktree lifecycle and branch cleanup."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## Activation Contract
Use when creating, working within, or removing a Git Worktree for isolated vertical slice development in PricePulse.

## Hard Rules
1. **Isolated Path:** All worktrees must be created in `.worktrees/<slice-name>` (root-level, git-ignored).
2. **Branch Convention:** Branches must follow `feature/<subdomain>-<slice-name>` branching from `main`.
3. **Creation Command:**
   ```bash
   git worktree add .worktrees/<slice-name> -b feature/<subdomain>-<slice-name> main
   ```
4. **Strict Scope:** Within the worktree, touch ONLY files under `src/features/<subdomain>/<slice-name>/` (plus submodule registration if required). Never edit unrelated slices.
5. **Pre-Merge Verification Gate:** Inside the worktree, verify:
   ```bash
   pnpm test
   pnpm depcruise
   ```
   Both checks must pass cleanly.
6. **Mandatory Full Cleanup:** After merging changes to `main`, remove both the worktree AND the local branch:
   ```bash
   git worktree remove .worktrees/<slice-name>
   git branch -d feature/<subdomain>-<slice-name>
   ```

## Verification Gate
Run `git worktree list` and `git branch` to ensure:
- No orphaned worktree directories remain in `.worktrees/`.
- No stale merged feature branches remain in local git.
