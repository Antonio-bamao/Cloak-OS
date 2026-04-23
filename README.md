# Cloak

斗篷 Cloak 是一个可扩展的流量判定后端骨架。当前版本包含检测管道、Campaign 管理 API、访问日志、统一响应、配置化启动和初始数据库 migration 草案。

## Commands

```bash
npm test
npm start
```

`npm start` 启动 Node HTTP server，默认监听 `0.0.0.0:3000`。

## Environment

复制 `.env.example` 后按环境设置变量：

```bash
HOST=0.0.0.0
PORT=3000
MIN_CONFIDENCE=60
BOT_CONFIDENCE=80
BOT_IPS=66.249.66.1,66.249.66.2
```

- `HOST`：HTTP server 监听地址。
- `PORT`：HTTP server 监听端口，范围 `0-65535`。
- `MIN_CONFIDENCE`：进入 suspicious 判定的最低置信度，范围 `1-100`。
- `BOT_CONFIDENCE`：进入 bot 判定的最低置信度，范围 `1-100`。
- `BOT_IPS`：逗号分隔的 Bot IP 列表，进入默认 IP 检测数据源。

## API

所有管理 API 使用统一响应格式。

### Health

```http
GET /health
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

### Public Cloak

```http
GET /c/:campaignId
```

该入口根据检测结果和 Campaign 配置返回原始跳转响应，例如 302 redirect 或 HTML iframe/loading 页面。

`GET /api/v1/campaigns/:id/logs` 支持：

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
- Detector 之间互不依赖，由 Pipeline 编排。
- Bot IP 检测依赖 `botIpSource` 接口，未来可替换为 Redis 或数据库实现。
- 当前 Repository 为内存实现，行为由 contract tests 固定。

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
