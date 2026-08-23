# Delphic Admin — Agent Guide

Back-office for Delphic Arcana Collection. Monorepo: `backend/` (Go + ConnectRPC) + `frontend/` (Next.js).

See [docs/architecture.md](docs/architecture.md), [frontend/AGENTS.md](frontend/AGENTS.md), [docs/deployment.md](docs/deployment.md).

## CI/CD

- **CI**: PR → `main` → [`ci-pr.yml`](.github/workflows/ci-pr.yml) (lint + test)
- **CD**: merge to `main` → [`cd-main.yml`](.github/workflows/cd-main.yml) (build artifacts on GitHub, deploy on self-hosted) → [`scripts/ci-deploy.bash`](scripts/ci-deploy.bash)

`backend/public/` exists only in production—not built in the repo. **Do not** run `pnpm build`, `go build`, deploy, or `systemctl` unless the user explicitly allows it.

## Rules

- Do not change DDL; adapt GORM models when schema is incompatible
- Rebuild and restart after Go changes
- No real auth (`sessionStorage.delphic_logged_in`)
- Business APIs are Connect RPC only; routes in `backend/server/router.go`, middleware via `server.Chain`
- Do not commit one-off ops scripts or workflows

## Testing

[docs/testing.md](docs/testing.md)
