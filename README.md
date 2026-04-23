# Cloak

斗篷 Cloak 是一个可扩展的流量判定后端骨架。当前版本包含检测管道、Campaign 管理 API、访问日志、统一响应、配置化启动和初始数据库 migration 草案。

## Commands

```bash
npm test
npm run migrate
npm run migrate:dry-run
npm run migrate:status
npm start
```

`npm start` 启动 Node HTTP server，默认监听 `0.0.0.0:3000`。
`npm run migrate` 会在 `REPOSITORY_DRIVER=postgres` / `DATABASE_URL` 配置下执行 `migrations/*.sql`，并把已执行文件记录到 `schema_migrations`。
`npm run migrate:dry-run` 会读取当前 migration 状态，并告诉你“如果现在执行 migrate，会应用哪些文件”，但不会真正执行 SQL。
`npm run migrate:status` 会连接 PostgreSQL 并输出当前已知、已执行和 pending 的 migration 文件列表，适合联调前先做 smoke check。

也可以直接通过 CLI 覆盖连接信息或 migration 目录：

```bash
node src/database/run-migrations.js --status --database-url postgres://cloak:secret@127.0.0.1:5432/cloak
node src/database/run-migrations.js --dry-run --database-url postgres://cloak:secret@127.0.0.1:5432/cloak
node src/database/run-migrations.js --database-url postgres://cloak:secret@127.0.0.1:5432/cloak --migrations-dir migrations
node src/database/run-migrations.js --help
```

## Environment

复制 `.env.example` 后按环境设置变量：

```bash
HOST=0.0.0.0
PORT=3000
MIN_CONFIDENCE=60
BOT_CONFIDENCE=80
BOT_IPS=66.249.66.1,66.249.66.2
ADMIN_TOKEN=dev-admin-token
REPOSITORY_DRIVER=memory
DATABASE_URL=
```

- `HOST`：HTTP server 监听地址。
- `PORT`：HTTP server 监听端口，范围 `0-65535`。
- `MIN_CONFIDENCE`：进入 suspicious 判定的最低置信度，范围 `1-100`。
- `BOT_CONFIDENCE`：进入 bot 判定的最低置信度，范围 `1-100`。
- `BOT_IPS`：逗号分隔的 Bot IP 列表，进入默认 IP 检测数据源。
- `ADMIN_TOKEN`：管理 API Bearer token。生产环境必须替换示例值。
- `REPOSITORY_DRIVER`：仓储驱动，支持 `memory` 或 `postgres`；默认 `memory`。
- `DATABASE_URL`：当 `REPOSITORY_DRIVER=postgres` 时必填，供内置 `pg` 驱动创建 PostgreSQL 连接池使用。

## API

所有管理 API 使用统一响应格式，并要求：

```http
Authorization: Bearer <ADMIN_TOKEN>
```

### Health

```http
GET /health
```

### Admin UI

```http
GET /admin
```

### Campaigns

```http
GET /api/v1/campaigns
POST /api/v1/campaigns
GET /api/v1/campaigns/:id
PUT /api/v1/campaigns/:id
DELETE /api/v1/campaigns/:id
GET /api/v1/campaigns/:id/logs
```

### Analytics

```http
GET /api/v1/analytics/overview
```

### Logs

```http
GET /api/v1/logs
```

### Public Cloak

```http
GET /c/:campaignId
```

该入口根据检测结果和 Campaign 配置返回原始跳转响应，例如 302 redirect 或 HTML iframe/loading 页面。

`GET /api/v1/campaigns/:id/logs` 与 `GET /api/v1/logs` 支持：

- `page`
- `pageSize`
- `verdict`
- `action`
- `ipAddress`
- `from`
- `to`

## Architecture Notes

- Route 层只做 HTTP 适配并调用 Service。
- Service 负责编排 Repository、DetectionPipeline、DecisionEngine 和跳转策略。
- AnalyticsService 独立汇总管理台概览数据，不侵入 CampaignService。
- Detector 之间互不依赖，由 Pipeline 编排。
- Bot IP 检测依赖 `botIpSource` 接口，未来可替换为 Redis 或数据库实现。
- 默认 Repository 仍使用内存实现，行为由 contract tests 固定。
- 已提供可注入 `client.query(sql, params)` 的 PostgreSQL 风格仓储适配器：
  - `PostgresCampaignRepository`
  - `PostgresAccessLogRepository`
- 项目已内置官方 `pg` 驱动，默认通过 `REPOSITORY_DRIVER=postgres` 和 `DATABASE_URL` 自动创建 PostgreSQL Pool 连接池。
- 启动流程会在监听 HTTP 端口前执行一次数据库连通性校验；如果数据库不可达，服务不会进入半启动状态。
- PostgreSQL 仓储适配器位于 `src/repositories/postgres/`，并通过 `REPOSITORY_DRIVER=postgres` 选择；Service 和 Route 不需要因为驱动切换而修改。
- `startServer()` 仍支持直接注入 `postgresClient`，或注入 `createPostgresClient(databaseUrl)` 覆盖默认 `pg` Pool 装配。

## Database

初始 migration 草案位于：

```text
migrations/001_initial.sql
```

它当前覆盖：

- `campaigns`
- `access_logs`
- tenant/audit 字段
- 访问日志索引
- 访问日志按 `created_at` 范围分区声明

运行 `npm run migrate` 时，系统会按文件名顺序执行 `migrations/` 下的 `.sql` 文件，并通过 `schema_migrations` 表跳过已执行项。
运行 `npm run migrate:dry-run` 时，系统不会执行 SQL，只会列出当前 would-apply 的 migration 列表。
运行 `npm run migrate:status` 时，系统会列出全部 migration、已执行 migration 和 pending migration，便于在真实库联调前先确认状态。

建议真实 PostgreSQL 联调时按这个 smoke-check 顺序执行：

1. 先确认 `DATABASE_URL` 指向测试库，而不是生产库。
2. 先运行 `npm run migrate:status` 或 `node src/database/run-migrations.js --status --database-url <url>`，检查 pending migration 是否符合预期。
3. 再运行 `npm run migrate` 或带 `--database-url` 的 migrate 命令执行 schema 初始化。
4. 最后再以 `REPOSITORY_DRIVER=postgres` 启动服务，验证 `/health` 和管理 API。
