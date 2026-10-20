# Delphic Admin — Agent Guide

Back-office for Delphic Arcana Collection. Next.js static export in `frontend/`, Cloudflare Pages Functions in `functions/`, data in Cloudflare D1.

See [frontend/AGENTS.md](frontend/AGENTS.md).

## CI

- PR or push to `main` → [`ci-pr.yml`](.github/workflows/ci-pr.yml) typechecks and builds the frontend

**Do not** run `pnpm build` or deploy unless the user explicitly allows it.

## Rules

- The business API is `functions/api/[[path]].ts`. It reads and writes the D1 binding `DB`.
- Do not commit one-off ops scripts or workflows.
