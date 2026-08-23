# 测试与验证

## 流程概览

```
开发 → 本地联调（见 deployment.md）
         │
         ▼
    开 PR → main          ci-pr.yml（lint + test + build）
         │
         ▼
    合并 → push main      cd-main.yml（build artifact → self-hosted 部署）
         │
         ▼
    验证生产可用
```

## PR 阶段（CI）

由 [`.github/workflows/ci-pr.yml`](../.github/workflows/ci-pr.yml) 自动执行：

- golangci-lint、buf lint
- `go test` / `go build`
- 前端 `tsc` + `pnpm build`

**不部署。** 合并前应等 CI 全绿（建议开启分支保护 required checks）。

## 合并后（CD）

由 [`.github/workflows/cd-main.yml`](../.github/workflows/cd-main.yml) 自动执行：

1. GitHub 托管 runner 构建前后端并上传 artifact
2. Self-hosted runner 下载 artifact，执行 [`scripts/ci-deploy.bash`](../scripts/ci-deploy.bash) 安装并重启服务

**不在 deploy 阶段跑 lint。**

## 部署后验证

确认服务已启动、页面可打开、核心功能正常即可。异常时先查 Actions 日志与 `systemctl status delphic-admin`。

## 常见问题

| 现象 | 排查方向 |
|------|----------|
| CD deploy 慢或失败 | Actions 日志；self-hosted 需能访问 GitHub（含 `*.blob.core.windows.net` artifact CDN，经 mihomo 代理） |
| 页面/API 异常 | 是否完成本次 deploy；后端进程是否重启 |
| PR CI 失败 | 本地复现对应 lint/test 步骤后修复再推 |
