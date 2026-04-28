# 斗篷系统使用手册

这份文档说明斗篷系统启动后怎么使用。

## 核心概念

每个 Campaign 有两个目标地址：

- `safeUrl`：安全页 / 白页，给机器人或可疑流量看。
- `moneyUrl`：真实页 / 黑页 / 黑夜页，给真人流量看。

公开访客访问：

```http
GET /c/:campaignId
```

斗篷系统会把请求交给检测管道，记录访问日志，然后按 Campaign 配置返回跳转策略响应：redirect、iframe 或 loading。

## 管理台

打开：

```text
http://127.0.0.1:3000/admin
```

输入你的 `ADMIN_TOKEN`。管理台和外部客户端一样，只调用管理 API，并发送：

```http
Authorization: Bearer <ADMIN_TOKEN>
```

你可以在管理台里：

- 创建和编辑 Campaign。
- 设置 `safeUrl` 和 `moneyUrl`。
- 选择跳转模式。
- 查看访问日志。
- 查看 `verdict` 和 `action` 统计。

## 用 API 创建 Campaign

```bash
curl -X POST http://127.0.0.1:3000/api/v1/campaigns \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "白页黑夜页测试",
    "safeUrl": "https://example.com/white-page",
    "moneyUrl": "https://example.com/black-night-page",
    "redirectMode": "redirect"
  }'
```

响应里会返回 Campaign 的 `id`。你的公开斗篷链接是：

```text
http://127.0.0.1:3000/c/<campaign-id>
```

## 测试：机器人看白页，真人看黑页

用下面这组步骤验证核心斗篷行为。

### 1. 配置 URL

创建或更新一个 Campaign：

- `safeUrl`：你的白页，例如 `https://example.com/white-page`。
- `moneyUrl`：你的黑页 / 黑夜页，例如 `https://example.com/black-night-page`。
- `redirectMode`：建议先用 `redirect`，因为最容易通过 `302 Location` 检查结果。

### 2. 用爬虫 User-Agent 触发机器人流量

生产默认不配置 `BOT_IPS` 示例值。先用已知爬虫 User-Agent 验证检测管道会把机器人流量送到白页：

```bash
curl -i http://127.0.0.1:3000/c/<campaign-id> \
  -H "User-Agent: Googlebot/2.1 (+http://www.google.com/bot.html)"
```

预期结果：

- 响应跳转到 `safeUrl`。
- 访问日志里的 `verdict` 是 `bot`。
- 访问日志里的 `action` 是 `safe`。

如果你已经有真实 Bot IP 情报源，也可以把确认后的 IP 写入 `BOT_IPS`，再通过真实代理链路进入系统；不要把文档里的示例 IP 当成线上规则。

### 3. 触发真人流量

使用普通浏览器 User-Agent 访问同一个公开链接：

```bash
curl -i http://127.0.0.1:3000/c/<campaign-id> \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
```

预期结果：

- 响应跳转到 `moneyUrl`。
- 访问日志里的 `verdict` 是 `human`。
- 访问日志里的 `action` 是 `money`。

## 查看日志

```bash
curl "http://127.0.0.1:3000/api/v1/logs?page=1&pageSize=20" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

筛选机器人 / 白页流量：

```bash
curl "http://127.0.0.1:3000/api/v1/logs?verdict=bot&action=safe" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

筛选真人 / 黑页流量：

```bash
curl "http://127.0.0.1:3000/api/v1/logs?verdict=human&action=money" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## 查看统计

```bash
curl http://127.0.0.1:3000/api/v1/analytics/overview \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

用 `verdict` 和 `action` 计数确认 Campaign 正在按预期区分机器人流量和真人流量。
