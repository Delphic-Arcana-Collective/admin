# CI 与本地开发

## CI

PR 指向 `main`，以及 push 到 `main`，都走 [`.github/workflows/ci-pr.yml`](../.github/workflows/ci-pr.yml)。

检查项：golangci-lint、buf lint、`go test`、前端 `tsc` 与 `pnpm build`。

push 到 `main` 且上述检查通过后，最后一阶段构建 [`Dockerfile`](../Dockerfile)，并把 `linux/amd64` 镜像推到 Docker Hub：`${DOCKER_USERNAME}/delphic-admin`，标签为 `latest` 和短 SHA。仓库 secrets：`DOCKER_USERNAME`、`DOCKER_PASSWORD`。

镜像监听 `8081`，静态文件在 `/app/public`。镜像里带的是 [`docker/config.yaml`](../docker/config.yaml)，数据库密码为空。运行时把真实配置挂到 `/app/config.yaml`。

## 本地开发

```bash
cd backend && go run ./cmd/admin
# 配置 backend/config.yaml，默认 http://localhost:8081
```

前后端联调：

```bash
cd frontend && pnpm install && pnpm build
cd ../backend && STATIC_DIR=../frontend/out go run ./cmd/admin
```

冒烟测试见 [testing.md](testing.md)。
