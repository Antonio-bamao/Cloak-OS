# PostgreSQL Runtime Integration Design

**Date:** 2026-04-23

**Status:** Proposed and approved for implementation

## Goal

让项目在 `REPOSITORY_DRIVER=postgres` 时可以直接使用官方 PostgreSQL 驱动启动，并继续保持现有 `Route -> Service -> Repository` 分层与 `client.query(sql, params)` 仓储边界不变。

## Scope

本次设计只覆盖真实 PostgreSQL 驱动接入与启动装配安全性，包括依赖引入、连接池创建、启动时连通性校验、关闭时资源释放、错误处理、测试和文档更新。

本次设计不覆盖：

- 真实数据库迁移执行器
- Docker / compose 环境
- 仓储 SQL 语义调整
- 管理台 UI 变更
- 运行时自动建表

## Current State

- 代码已经支持 `memory` 和 `postgres` 两种仓储驱动配置。
- PostgreSQL 仓储已经实现，但只依赖外部注入的 `client.query(sql, params)`。
- `startServer()` 当前支持 `postgresClient` 或 `createPostgresClient(databaseUrl)` 注入，但项目本身不内置真实驱动。
- `createApp()` 和业务层已经通过仓储工厂完成装配，说明真实驱动接入点应继续放在启动和基础设施层，而不是下沉到 Service 或 Repository。

## Recommended Approach

采用官方 `pg` 驱动，并在基础设施层新增 PostgreSQL client factory，由它创建 `pg.Pool`，执行一次启动前连通性校验，然后把 pool 作为 `postgresClient` 传给现有仓储工厂。

这是当前最稳妥的方案，因为：

- `pg.Pool` 比单连接更适合长时间运行的服务。
- 仓储层仍只依赖 `query(sql, params)`，不会和具体驱动 API 深度耦合。
- 装配改动集中在启动入口和基础设施层，业务逻辑不需要改写。
- 测试仍可继续使用 fake client，不会把单元测试绑死到真实数据库。

## Rejected Alternatives

### 继续只支持外部注入 client

优点是改动最少，但项目仍然无法独立以 PostgreSQL 模式启动，实际交付时还要额外补一层外部装配，无法形成闭环。

### 把驱动逻辑塞进 Repository

这会让仓储同时承担 SQL 映射和连接生命周期管理两类职责，破坏已经建立好的边界，也会让测试更重、更脆。

## Design

### 1. Dependency Boundary

新增 `pg` 依赖，但驱动使用范围限制在新的基础设施文件内，例如 `src/infrastructure/postgres/create-postgres-client.js`。其职责只有：

- 根据 `DATABASE_URL` 创建 `Pool`
- 提供一次连通性校验
- 暴露统一的 `query()` / `end()` 能力

Repository 不直接 import `pg`，继续只接收兼容 `query(sql, params)` 的对象。

### 2. Startup Flow

当 `repository.driver !== 'postgres'` 时，启动路径保持不变。

当 `repository.driver === 'postgres'` 时：

1. 如果调用方显式注入 `postgresClient`，优先使用它。
2. 否则如果注入了 `createPostgresClient(databaseUrl)`，继续使用现有扩展点。
3. 否则使用项目内置的 `pg` factory 创建 `Pool`。
4. 在 HTTP server `listen()` 之前执行一次数据库连通性校验。
5. 连通性校验成功后，再创建 app 并监听端口。

这样可以保证服务不会出现“HTTP 已经对外可用，但数据库实际上不可连接”的半启动状态。

### 3. Shutdown Flow

若本次启动流程创建了内部 PostgreSQL pool，则需要在 server 关闭时同时释放它。

做法是让 `startServer()` 在内部包一层 `server.close()`：先关闭 HTTP server，再执行 `pool.end()`，并向调用方保留原有 `close(callback)` 行为。若使用的是外部注入 client，则不接管其释放生命周期。

### 4. Error Handling

错误处理遵循“尽早失败”原则：

- 缺少 `DATABASE_URL`：继续由 `validateConfig()` 阻断启动。
- 内置 factory 创建或连通性校验失败：`startServer()` reject，HTTP server 不开始监听。
- 关闭时 `pool.end()` 失败：`server.close(callback)` 回调收到错误，便于测试和上层处理。

错误码层面优先复用现有 `CONFIG_INVALID` / `POSTGRES_CLIENT_REQUIRED`，只有在确实需要区分“连接失败”时再考虑新增更具体的错误码，避免过早扩展。

### 5. Testing Strategy

测试继续走 TDD，并分成三层：

- 基础设施单测：验证内置 PostgreSQL factory 会用 `DATABASE_URL` 创建 `pg.Pool`，并暴露兼容接口。
- 启动装配单测：验证 postgres 模式下默认会调用内置 factory、先做连通性校验、再创建 app。
- 生命周期单测：验证内部创建的 pool 会在 `server.close()` 时被 `end()`，外部注入 client 不会被误释放。

不在单元测试中引入真实 PostgreSQL 服务，避免当前阶段把测试环境复杂化。

### 6. Documentation

README 和 `.env.example` 需要同步说明：

- 已内置官方 `pg` 驱动
- `REPOSITORY_DRIVER=postgres` 时服务会根据 `DATABASE_URL` 自动创建连接池
- 启动前会进行数据库连通性校验
- 若需要更特殊的数据库接入方式，`startServer()` 仍支持注入自定义 `postgresClient` 或 `createPostgresClient`

## Files Expected To Change

- `package.json`
- `README.md`
- `.env.example`
- `src/server/start.js`
- `test/server-start.test.js`

预计新增：

- `src/infrastructure/postgres/create-postgres-client.js`
- `test/create-postgres-client.test.js`

## Acceptance Criteria

- 配置 `REPOSITORY_DRIVER=postgres` 和合法 `DATABASE_URL` 后，项目无需外部注入即可进入 PostgreSQL 模式。
- 启动时数据库不可连接，则服务不监听 HTTP 端口。
- 关闭内部创建的 PostgreSQL client 时会正确释放连接池。
- 现有仓储、Service、Route 公开接口保持不变。
- 全量测试继续通过，且新增覆盖真实驱动装配路径。
