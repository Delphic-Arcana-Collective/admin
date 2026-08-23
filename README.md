# Delphic Admin

Back-office system for Delphic Arcana Collection: fund flows, product inventory, orders, exhibitions, calendar events, and NFC links.

Monorepo: `backend/` (Go + ConnectRPC + GORM + PostgreSQL) + `frontend/` (Next.js static export SPA).

## Tech stack (summary)

| Layer | Technology |
|-------|------------|
| Backend | Go 1.27, ConnectRPC, `net/http`, GORM, PostgreSQL |
| APIs | buf + protobuf (`backend/proto/`) |
| Frontend | Next.js 15, `output: "export"`, React 19, Tailwind 4, TypeScript |
| Package managers | pnpm (frontend); Go modules (backend) |

Details: [docs/architecture.md](docs/architecture.md).

## CI/CD

Push to `main` (or manually trigger Actions) runs [`.github/workflows/cd-main.yml`](.github/workflows/cd-main.yml):

1. **GitHub-hosted runners** (`ubuntu-24.04`): build backend binary + frontend, upload artifacts (no lint).
2. **Org-level self-hosted runner** (`delphic-admin-server`): download artifacts, run [`scripts/ci-deploy.bash`](scripts/ci-deploy.bash) (install + restart only).

PRs targeting `main` run [`.github/workflows/ci-pr.yml`](.github/workflows/ci-pr.yml) for full lint + compile checks before merge.

Production runtime directory: `/usr/local/delphic-admin`; `backend/public/` exists only there—not built or committed in the repo.

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
