# Delphic Admin

Back-office system for Delphic Arcana Collection: fund flows, product inventory, orders, exhibitions, and NFC links.

Monorepo: `backend/` (Go + ConnectRPC + GORM + PostgreSQL) + `frontend/` (Next.js static export SPA).

## Tech stack (summary)

| Layer | Technology |
|-------|------------|
| Backend | Go 1.27, ConnectRPC, `net/http`, GORM, PostgreSQL |
| APIs | buf + protobuf (`backend/proto/`) |
| Frontend | Next.js 15, `output: "export"`, React 19, Tailwind 4, TypeScript |
| Package managers | pnpm (frontend); Go modules (backend) |

Details: [docs/architecture.md](docs/architecture.md).

## CI

[`.github/workflows/ci-pr.yml`](.github/workflows/ci-pr.yml) runs on pull requests to `main` and on pushes to `main`: golangci-lint, buf lint, `go test`, and the frontend typecheck plus build.

A push to `main` continues to a final job that builds [`Dockerfile`](Dockerfile) and pushes `linux/amd64` tags `:latest` and `:<short-sha>` to Docker Hub as `${DOCKER_USERNAME}/delphic-admin`. Repository secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD`.

The image listens on `8081` and serves the static export from `/app/public`. It ships [`docker/config.yaml`](docker/config.yaml) with an empty database password. Mount a real config over `/app/config.yaml` at runtime.

Full details: [docs/deployment.md](docs/deployment.md).

## Local development

```bash
# Backend only (requires backend/config.yaml and PostgreSQL)
cd backend && go run ./cmd/admin

# Full-stack dev
cd frontend && pnpm install && pnpm build
cd ../backend && STATIC_DIR=../frontend/out go run ./cmd/admin
```

Default: `http://localhost:8081`. Verification flow: [docs/testing.md](docs/testing.md).

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/architecture.md](docs/architecture.md) | Layout, Connect services, routing, data models |
| [docs/deployment.md](docs/deployment.md) | CI/CD, self-hosted runner, deploy scripts |
| [docs/testing.md](docs/testing.md) | CI/CD verification flow and troubleshooting |
| [AGENTS.md](AGENTS.md) | Cursor / agent collaboration guidelines |
