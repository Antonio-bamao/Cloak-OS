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
BOT_IP_SOURCE=env
BOT_IP_FILE_PATH=
LOG_FILE_PATH=/app/logs/cloak.log
LOG_MAX_BYTES=10485760
LOG_MAX_FILES=5
```

生产默认不配置 BOT_IPS，避免把示例 IP 当成线上规则。真实流量会先经过 User-Agent 检测；如果你有自己的 Bot IP 情报源，可以保持 `BOT_IP_SOURCE=env` 并把确认后的 IP 以英文逗号写入 `BOT_IPS`。常见爬虫 User-Agent，例如 `Googlebot`，也会被 UA 检测器识别。

如果要用文件维护 Bot IP 列表，设置：

```bash
BOT_IP_SOURCE=file
BOT_IP_FILE_PATH=/app/config/bot-ips.txt
```

文件格式是一行一个 IP，支持空行和 `#` 注释。生产部署时可把宿主机上的确认名单以只读方式挂载到容器内，例如把 `./config/bot-ips.txt` 挂载到 `/app/config/bot-ips.txt`。

如果你的情报源能提供文本名单，可以先用同步命令生成或更新文件：

```bash
npm run bot-ips:sync -- --source-url https://intel.example/bot-ips.txt --output ./config/bot-ips.txt --dry-run
npm run bot-ips:sync -- --source-url https://intel.example/bot-ips.txt --output ./config/bot-ips.txt
```

同步命令支持重复传入 `--source-url` 和 `--source-file`，会去重、忽略空行与 `#` 注释。也可以通过 `BOT_IP_SYNC_URLS`、`BOT_IP_SYNC_FILES` 和 `BOT_IP_FILE_PATH` 环境变量接到 cron。

文件名单更新后，可以在管理台“系统设置”点击“重载 Bot IP”，或调用受保护接口：

```bash
curl -X POST https://cloak.example.com/api/v1/settings/bot-ips/reload \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

该接口只重载文件型 Bot IP source；`env` 来源仍需修改环境变量并重启应用。

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

建议定期做一次恢复演练，不要直接恢复到生产库。演练脚本会启动一个临时 PostgreSQL 容器，把备份恢复进去，然后对恢复后的数据库运行 migration status、只读 smoke、API smoke 和 Admin smoke：

```powershell
.\scripts\verify-postgres-restore.ps1 -BackupPath .\backups\<backup-file>.sql
```

默认临时容器名为 `cloak-restore-drill`，宿主机端口为 `55433`。如端口被占用，可覆盖：

```powershell
.\scripts\verify-postgres-restore.ps1 -BackupPath .\backups\<backup-file>.sql -HostPort 55434
```

脚本结束后会停止临时容器；如果演练失败，先查看输出并确认备份文件、Docker 状态和端口占用。

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

## 10. 生产监控和告警

可以用内置监控命令检查运行中的服务：

```bash
npm run monitor:production -- --base-url https://cloak.example.com --admin-token <ADMIN_TOKEN>
```

该命令会检查 `/health` 返回 `status=ok`，并检查 `/api/v1/settings` 中的仓储状态。默认期望仓储为 `postgres`；如需覆盖可追加：

```bash
--expect-repository postgres
```

如果希望失败时发出通用 Webhook 告警，可追加：

```bash
--alert-webhook-url https://alerts.example/webhook
```

告警请求是 `POST` JSON，包含 `service`、`status`、`baseUrl` 和 `error` 字段。可以把这个命令接到 cron、GitHub Actions 定时任务、Uptime Kuma 的通知链路或其他监控平台。
