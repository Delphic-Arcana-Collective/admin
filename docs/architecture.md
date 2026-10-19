# 架构

## 概述

德尔菲秘仪社后台：资金流水、展会、NFC。Monorepo：`backend/`（Go + ConnectRPC + GORM + PostgreSQL，托管静态前端）+ `frontend/`（Next.js 静态导出 SPA）。

## 技术栈

版本以 lock 文件为准（`backend/go.mod`、`frontend/pnpm-lock.yaml`）。

| 层 | 技术 | 版本 |
|----|------|------|
| 后端语言 | Go | 1.27 |
| RPC | ConnectRPC + `net/http` | connect v1.20.0 |
| 接口定义 | buf + protobuf | buf v2 |
| ORM | GORM + `gorm.io/driver/postgres` | v1.25.5 / v1.5.4 |
| 数据库 | PostgreSQL | `backend/config.yaml` |
| 前端框架 | Next.js（`output: "export"`） | 15.5.15 |
| UI | React | 19.2.4 |
| 样式 | Tailwind CSS | 4.2.4 |
| 语言 | TypeScript | 5.9.3 |
| 包管理 | pnpm（前端） | — |

前端通过 `frontend/src/lib/api.ts` 手写 Connect JSON `fetch` 调用（非 codegen 客户端）。

## 目录结构

```
backend/
  cmd/admin/   程序入口
  proto/       Protobuf 定义与 buf 配置
  service/     Connect RPC handler 实现
  server/      services、router（configRouters）、middleware（Chain）、static
  store/       GORM 模型与 DB 操作
frontend/
  out/             Next.js 静态导出（构建产物，不提交 Git）
  src/app/         页面
  src/lib/api.ts   Connect JSON 客户端
  src/config.ts    API 基址（NEXT_PUBLIC_API_BASE）
```

## Connect 服务

在 `backend/server/router.go` 的 `configRouters` 注册：

| 服务 | 包路径 |
|------|--------|
| Health | `health.v1.HealthService` |
| Dashboard | `dashboard.v1.DashboardService` |
| FundFlow | `fund_flow.v1.FundFlowService` |
| Exhibition | `exhibition.v1.ExhibitionService` |
| File | `file.v1.FileService` |

另有非 Connect 端点：

- `GET /health` — 简单健康检查

## 数据关系

```
FundFlow ──► Dashboard（流水增删改联动更新总余额，事务内完成）
Exhibition ── 封面与附件指向 File
```

## HTTP 请求处理

入口：`server.NewHandler(staticDir)` → `server.Chain(app, defaultMiddlewares...)`。

`App.ServeHTTP` 分发顺序：

1. Connect RPC（路径含 `.v1.`，由 `connectRouter` 按服务前缀路由）
2. 辅助 HTTP：`GET /health`（在 `configRouters` 注册）
3. 静态文件 / SPA `index.html` 回退

中间件链（`server/middleware.go`）：CORS → Recovery，通过 `Chain` 组合，禁止嵌套包装写法。

静态资源 `Cache-Control: no-cache, no-store, must-revalidate`。**禁止**为单个 HTML 注册独立静态路由。

## 认证

无真实鉴权。登录页写 `sessionStorage.delphic_logged_in`；后端不校验 token。

## 已知限制

无权限体系、无 HTTPS、无单元测试。
