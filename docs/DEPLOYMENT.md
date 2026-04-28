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
LOG_FILE_PATH=/app/logs/cloak.log
LOG_MAX_BYTES=10485760
LOG_MAX_FILES=5
```

生产默认不配置 BOT_IPS，避免把示例 IP 当成线上规则。真实流量会先经过 User-Agent 检测；如果你有自己的 Bot IP 情报源，再把确认后的 IP 以英文逗号写入 `BOT_IPS`。常见爬虫 User-Agent，例如 `Googlebot`，也会被 UA 检测器识别。

日志默认写入容器内 `/app/logs/cloak.log`，Compose 会挂载到 `cloak-app-logs` volume。`LOG_MAX_BYTES` 控制单个日志文件最大字节数，`LOG_MAX_FILES` 控制总保留文件数（包含当前日志）；例如默认值会保留当前 `cloak.log` 加上 4 个轮转归档。

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

运行上线前检查：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run preflight:postgres
```

上线前检查会拒绝 pending migration，随后启动 PostgreSQL 模式应用，检查 health、settings、管理台资源，并创建临时 Campaign 验证 Googlebot 访问白页、普通浏览器访问黑页。检查完成后会删除本次临时 Campaign 和访问日志。

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

## 6. Nginx / TLS 反向代理

仓库提供了一个 Nginx 示例：

```text
deploy/nginx/cloak.conf.example
```

使用前把 `cloak.example.com` 换成你的域名，并把证书路径换成你的真实 TLS 证书路径。建议：

- 只把 Nginx 的 80 / 443 暴露到公网。
- app 端口只监听本机或内网。
- PostgreSQL 不要暴露公网。
- `/c/:campaignId` 是公开投放入口。
- `/admin` 和 `/api/v1/*` 建议在反向代理层限制来源 IP；管理 API 仍必须带 `Authorization: Bearer <ADMIN_TOKEN>`。
- 反代必须保留 `X-Forwarded-For`，否则访问日志和 IP 检测只能看到代理 IP。

## 7. 日志轮转

应用会输出 JSON Lines 结构化日志。生产 Compose 默认配置：

```bash
LOG_FILE_PATH=/app/logs/cloak.log
LOG_MAX_BYTES=10485760
LOG_MAX_FILES=5
```

当当前日志文件超过 `LOG_MAX_BYTES`，应用会把 `cloak.log` 轮转为 `cloak.log.1`，旧归档依次后移，超过 `LOG_MAX_FILES` 的归档会被删除。`LOG_FILE_PATH` 为空时会回退到 stdout，适合交给平台日志系统收集。

查看最近日志：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec app tail -n 100 /app/logs/cloak.log
```

## 8. 备份和恢复

创建 PostgreSQL SQL 备份：

```powershell
.\scripts\backup-postgres.ps1 -EnvFile .env.production
```

备份会写入本地 `backups/` 目录，该目录不会提交到 Git，也不会进入 Docker build context。

恢复前需要显式确认，避免误操作覆盖生产库：

```powershell
$env:CLOAK_CONFIRM_RESTORE='yes'
.\scripts\restore-postgres.ps1 -EnvFile .env.production -BackupPath .\backups\<backup-file>.sql
```

恢复脚本会通过 Compose 内部的 `postgres` 服务执行 `psql`，不会要求把数据库端口暴露到公网。

## 9. 更新发布流程

仓库内置两个 GitHub Actions workflow：

- `.github/workflows/ci.yml`：在 push / pull request 上运行测试、Compose 配置解析和 `.context` 校验。
- `.github/workflows/release-smoke.yml`：手动触发，使用 PostgreSQL service container 跑 migration、smoke-check 和上线前检查。

建议每次发布前先在 GitHub Actions 手动运行 `release-smoke.yml`。通过后再执行服务器更新：

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build app
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run migrate
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run smoke:postgres-api -- --check-health
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm app npm run preflight:postgres
docker compose --env-file .env.production -f docker-compose.prod.yml up -d app
```

如果 smoke-check 失败，先保留旧版本应用，查看错误输出，不要继续发布。
