# CI/CD 与本地开发

## CI/CD 架构

```
PR → main                          push main（合并后）
      │                                    │
      ▼                                    ▼
.github/workflows/ci-pr.yml        .github/workflows/cd-main.yml
  golangci-lint / proto-lint         backend + frontend build → artifacts
  go-test / frontend tsc+build
  （不部署）                               │
                                           ▼
                                    deploy（self-hosted）
                                           │
                                           ▼
                                    scripts/ci-deploy.bash
                                      restart systemd
```

| 工作流 | 触发 | Runner | 作用 |
|--------|------|--------|------|
| `ci-pr.yml` | PR 指向 `main` | `ubuntu-24.04` | 完整 CI：lint + 编译测试 |
| `cd-main.yml` | push `main`、手动 | `ubuntu-24.04` + self-hosted | 编译测试通过后部署 |

前后端均在 GitHub 上构建并上传 artifact，self-hosted 仅安装二进制与静态文件，不在服务器上编译。

Self-hosted runner 通过 mihomo（`127.0.0.1:7890`）访问 GitHub；artifact 下载走 `*.blob.core.windows.net`，须在代理规则中走 Proxy，否则会直连很慢。

## 部署脚本

**生产（CI）** — workflow 将 artifact 下载到 `$DEPLOY_PATH/backend/`，[`scripts/ci-deploy.bash`](../scripts/ci-deploy.bash) 校验文件并 `systemctl restart delphic-admin`（无 unit 时从 `scripts/delphic-admin.service` 安装）。

| 路径 | 说明 |
|------|------|
| `frontend/out/` | Next.js 构建输出（CD 由 GitHub 生成） |
| `$DEPLOY_PATH/backend/public/` | 生产静态目录 |
| `backend/delphic_admin` | Go 二进制 |

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
