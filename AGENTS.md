# Delphic Admin — Agent Guide

Back-office for Delphic Arcana Collection. Monorepo: `backend/` (Go + ConnectRPC) + `frontend/` (Next.js).

See [docs/architecture.md](docs/architecture.md), [frontend/AGENTS.md](frontend/AGENTS.md), [docs/deployment.md](docs/deployment.md).

## CI

- PR or push to `main` → [`ci-pr.yml`](.github/workflows/ci-pr.yml) (lint + test)
- Push to `main`, after those checks: build [`Dockerfile`](Dockerfile) and push `${DOCKER_USERNAME}/delphic-admin` (`:latest` and `:<short-sha>`) to Docker Hub

**Do not** run `pnpm build`, `go build`, or deploy unless the user explicitly allows it.

## Rules

- Do not change DDL; adapt GORM models when schema is incompatible
- Rebuild and restart after Go changes
- No real auth (`sessionStorage.delphic_logged_in`)
- Business APIs are Connect RPC only; routes in `backend/server/router.go`, middleware via `server.Chain`
- Do not commit one-off ops scripts or workflows

## Testing

[docs/testing.md](docs/testing.md)
