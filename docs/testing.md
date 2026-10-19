# 测试与验证

## 流程概览

```
开发 → 本地联调（见 deployment.md）
         │
         ▼
    开 PR → main          ci-pr.yml（lint + test + build）
         │
         ▼
    合并 → push main      同一 workflow 的最后阶段构建并推送镜像
```

## PR 阶段

由 [`.github/workflows/ci-pr.yml`](../.github/workflows/ci-pr.yml) 自动执行：

- golangci-lint、buf lint
- `go test` / `go build`
- 前端 `tsc` + `pnpm build`

合并前应等 CI 全绿。

## push main

同一 workflow 在检查通过后构建镜像并推到 Docker Hub。失败时看 Actions 里 `docker` 这个 job。

## 常见问题

| 现象 | 排查方向 |
|------|----------|
| PR CI 失败 | 本地复现对应 lint/test 步骤后修复再推 |
| 镜像未推送 | 仓库是否配置 `DOCKER_USERNAME`、`DOCKER_PASSWORD`；`docker` job 是否在检查通过之后才跑 |
