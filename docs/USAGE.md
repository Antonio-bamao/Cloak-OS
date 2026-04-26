# Cloak Usage Guide

This guide explains how to use Cloak after it is running.

## Core Idea

Each Campaign has two destination URLs:

- `safeUrl`: the safe/white page shown to bot or suspicious traffic.
- `moneyUrl`: the real/black or black-night page shown to human traffic.

Public visitors use:

```http
GET /c/:campaignId
```

Cloak runs the request through the detection pipeline, records an access log, and returns the configured strategy response: redirect, iframe, or loading page.

## Admin UI

Open:

```text
http://127.0.0.1:3000/admin
```

Enter your `ADMIN_TOKEN`. The Admin UI uses the same management APIs as external clients and sends:

```http
Authorization: Bearer <ADMIN_TOKEN>
```

From the Admin UI you can:

- Create and edit Campaigns.
- Set `safeUrl` and `moneyUrl`.
- Choose redirect mode.
- View logs.
- View verdict and action analytics.

## Create a Campaign with the API

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

The response contains the Campaign `id`. Your public cloak link is:

```text
http://127.0.0.1:3000/c/<campaign-id>
```

## Test: Bot Sees White Page, Human Sees Black Page

Use this recipe to verify the main cloak behavior.

### 1. Configure URLs

Create or update one Campaign:

- `safeUrl`: your 白页, for example `https://example.com/white-page`.
- `moneyUrl`: your 黑页 / 黑夜页, for example `https://example.com/black-night-page`.
- `redirectMode`: `redirect` is easiest to inspect because the response is a `302 Location`.

### 2. Trigger Bot Traffic with BOT_IPS

Set `BOT_IPS` before starting the app:

```bash
BOT_IPS=203.0.113.10
```

Then send a request that appears to come from that IP:

```bash
curl -i http://127.0.0.1:3000/c/<campaign-id> \
  -H "X-Forwarded-For: 203.0.113.10" \
  -H "User-Agent: Mozilla/5.0"
```

Expected result:

- Response is a redirect to `safeUrl`.
- Access log `verdict` is `bot`.
- Access log `action` is `safe`.

### 3. Trigger Bot Traffic with Googlebot User-Agent

If you do not want to change `BOT_IPS`, use a known crawler User-Agent:

```bash
curl -i http://127.0.0.1:3000/c/<campaign-id> \
  -H "User-Agent: Googlebot/2.1 (+http://www.google.com/bot.html)"
```

Expected result:

- Response is a redirect to `safeUrl`.
- Access log `verdict` is `bot`.
- Access log `action` is `safe`.

### 4. Trigger Human Traffic

Use a normal browser-like User-Agent and an IP that is not in `BOT_IPS`:

```bash
curl -i http://127.0.0.1:3000/c/<campaign-id> \
  -H "X-Forwarded-For: 198.51.100.25" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
```

Expected result:

- Response is a redirect to `moneyUrl`.
- Access log `verdict` is `human`.
- Access log `action` is `money`.

## Inspect Logs

```bash
curl "http://127.0.0.1:3000/api/v1/logs?page=1&pageSize=20" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Filter bot/safe traffic:

```bash
curl "http://127.0.0.1:3000/api/v1/logs?verdict=bot&action=safe" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Filter human/money traffic:

```bash
curl "http://127.0.0.1:3000/api/v1/logs?verdict=human&action=money" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## Inspect Analytics

```bash
curl http://127.0.0.1:3000/api/v1/analytics/overview \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Use the `verdict` and `action` counts to confirm the Campaign is separating bot and human traffic as expected.
