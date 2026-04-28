# 生产部署

这份文档说明如何把斗篷系统以 PostgreSQL 模式部署起来。当前生产路径使用现有能力：`REPOSITORY_DRIVER=postgres`、数据库 migration、smoke-check，以及静态 `/admin` 管理台。

## 前置条件

- 已安装 Docker 和 Docker Compose v2。
- 有一台服务器或部署主机，只把斗篷应用端口暴露给外部访问。
- 准备一个足够长、不可猜的 `ADMIN_TOKEN`。
- 准备一个不要复用到其他系统的 PostgreSQL 密码。

## 1. 创建生产环境变量

创建一个不提交到 Git 的 `.env.production` 文件：

```bash
APP_PORT=3000
POSTGRES_DB=cloak
POSTGRES_USER=cloak
POSTGRES_PASSWORD=replace-with-a-long-random-password
ADMIN_TOKEN=replace-with-a-long-random-admin-token
MIN_CONFIDENCE=60
BOT_CONFIDENCE=80
```

生产默认不配置 BOT_IPS，避免把示例 IP 当成线上规则。真实流量会先经过 User-Agent 检测；如果你有自己的 Bot IP 情报源，再把确认后的 IP 以英文逗号写入 `BOT_IPS`。常见爬虫 User-Agent，例如 `Googlebot`，也会被 UA 检测器识别。

## 2. 启动 PostgreSQL

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres
```

生产 Compose 文件不会把 `5432` 映射到宿主机公网。应用会通过 Compose 内部网络访问 `postgres:5432`。

## 3. 执行数据库迁移

用一次性 app 容器执行 migration：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run migrate
```

查看 migration 状态：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run migrate:status
```

只预览待执行 migration，不真正执行 SQL：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run migrate:dry-run
```

## 4. 运行联调检查

运行只读 PostgreSQL smoke-check：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run smoke:postgres
```

运行 API smoke-check，并先探测健康接口：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run smoke:postgres-api -- --check-health
```

运行管理台 smoke-check，并先探测健康接口：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run smoke:postgres-admin -- --check-health
```

API smoke-check 会创建一个临时 Campaign，访问 `/c/:campaignId`，检查访问日志和 Analytics，然后默认删除本次创建的访问日志和 Campaign。需要保留样本时再追加 `--keep-campaign`。

## 5. 启动应用

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```

检查健康状态：

```bash
curl http://127.0.0.1:3000/health
```

打开管理台：

```text
http://127.0.0.1:3000/admin
```

管理台要求输入 token 时，填 `.env.production` 里的 `ADMIN_TOKEN`。

## 6. 反向代理建议

- 只把 app 端口暴露到公网。
- PostgreSQL 不要暴露公网。
- TLS、域名路由、请求日志建议放在反向代理或部署平台里处理。
- 投放流量访问 `/c/:campaignId`。
- 管理台访问 `/admin`；管理 API 访问 `/api/v1/*`，并带上 `Authorization: Bearer <ADMIN_TOKEN>`。

## 7. 更新发布流程

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build app
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run migrate
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run smoke:postgres-api -- --check-health
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```

如果 smoke-check 失败，先保留旧版本应用，查看错误输出，不要继续发布。
