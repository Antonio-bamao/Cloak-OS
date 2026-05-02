import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

import { createApp } from '../src/server/app.js';
import { startServer } from '../src/server/start.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const screenshotDir = path.join(projectRoot, 'test-output', 'admin-browser-layout');
const execFileAsync = promisify(execFile);
const adminToken = 'dev-admin-token';

const viewports = [
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'desktop-1440', width: 1440, height: 1000, mobile: false }
];

test('admin UI has no page overflow or undersized touch targets in real Chrome', {
  skip: process.env.RUN_BROWSER_LAYOUT === '1'
    ? false
    : 'Set RUN_BROWSER_LAYOUT=1 to run the real Chrome layout check.'
}, async () => {
  const chromePath = findChromePath();

  if (!chromePath) {
    assert.fail('Chrome was not found. Set CHROME_PATH to run browser layout checks.');
  }

  const app = createApp({
    logger: {
      info() {},
      error() {}
    }
  });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));

  const chrome = await launchChrome(chromePath);
  const client = await CdpClient.connect(chrome.webSocketDebuggerUrl);

  try {
    await mkdir(screenshotDir, { recursive: true });
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    const { port } = app.address();
    const url = `http://127.0.0.1:${port}/admin`;

    for (const viewport of viewports) {
      const result = await inspectViewport({
        client,
        viewport,
        url,
        waitFor: `
          document.readyState === 'complete' &&
            document.querySelector('#campaigns-table .empty-state') &&
            document.querySelector('#logs-table .empty-state')
        `
      });
      await writeFile(
        path.join(screenshotDir, `${viewport.name}.png`),
        Buffer.from(result.screenshot, 'base64')
      );

      assertHealthyLayout(result.metrics, viewport.name);
    }
  } finally {
    client.close();
    await chrome.close();
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('admin UI contains long non-empty tables without page overflow in real Chrome', {
  skip: process.env.RUN_BROWSER_LAYOUT === '1'
    ? false
    : 'Set RUN_BROWSER_LAYOUT=1 to run the real Chrome layout check.'
}, async () => {
  const chromePath = findChromePath();

  if (!chromePath) {
    assert.fail('Chrome was not found. Set CHROME_PATH to run browser layout checks.');
  }

  const app = createApp({
    logger: {
      info() {},
      error() {}
    }
  });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));

  const chrome = await launchChrome(chromePath);
  const client = await CdpClient.connect(chrome.webSocketDebuggerUrl);

  try {
    await mkdir(screenshotDir, { recursive: true });
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    const { port } = app.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    await seedLongCampaign(baseUrl);

    for (const viewport of viewports) {
      const result = await inspectViewport({
        client,
        viewport,
        url: `${baseUrl}/admin`,
        waitFor: `
          document.readyState === 'complete' &&
            document.querySelectorAll('#campaigns-table tr').length > 0 &&
            document.querySelectorAll('#logs-table tr').length > 0 &&
            !document.querySelector('#campaigns-table .empty-state') &&
            !document.querySelector('#logs-table .empty-state')
        `
      });
      await writeFile(
        path.join(screenshotDir, `${viewport.name}-long-data.png`),
        Buffer.from(result.screenshot, 'base64')
      );

      assertHealthyLayout(result.metrics, `${viewport.name} long-data`);
      assert.ok(
        result.metrics.tableWraps.every((tableWrap) => tableWrap.containsOverflow),
        `${viewport.name} table overflow should stay contained in table-wrap: ${JSON.stringify(result.metrics.tableWraps)}`
      );
    }
  } finally {
    client.close();
    await chrome.close();
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('postgres admin UI contains long non-empty tables without page overflow in real Chrome', {
  skip: process.env.RUN_BROWSER_LAYOUT === '1' && process.env.POSTGRES_BROWSER_LAYOUT_DATABASE_URL
    ? false
    : 'Set RUN_BROWSER_LAYOUT=1 and POSTGRES_BROWSER_LAYOUT_DATABASE_URL to run the postgres browser layout check.'
}, async () => {
  const chromePath = findChromePath();

  if (!chromePath) {
    assert.fail('Chrome was not found. Set CHROME_PATH to run browser layout checks.');
  }

  const server = await startServer({
    logger: {
      info() {},
      error() {}
    },
    config: {
      server: {
        host: '127.0.0.1',
        port: 0
      },
      auth: {
        adminToken
      },
      repository: {
        driver: 'postgres',
        databaseUrl: process.env.POSTGRES_BROWSER_LAYOUT_DATABASE_URL
      }
    }
  });
  const chrome = await launchChrome(chromePath);
  const client = await CdpClient.connect(chrome.webSocketDebuggerUrl);
  let campaignId;

  try {
    await mkdir(screenshotDir, { recursive: true });
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    campaignId = await seedLongCampaign(baseUrl, {
      name: `PostgreSQL 长链接布局回归 ${Date.now()}`
    });

    for (const viewport of viewports) {
      const result = await inspectViewport({
        client,
        viewport,
        url: `${baseUrl}/admin`,
        waitFor: `
          document.readyState === 'complete' &&
            document.body.textContent.includes('PostgreSQL 长链接布局回归') &&
            document.querySelectorAll('#campaigns-table tr').length > 0 &&
            document.querySelectorAll('#logs-table tr').length > 0 &&
            !document.querySelector('#campaigns-table .empty-state') &&
            !document.querySelector('#logs-table .empty-state')
        `
      });
      await writeFile(
        path.join(screenshotDir, `${viewport.name}-postgres-long-data.png`),
        Buffer.from(result.screenshot, 'base64')
      );

      assertHealthyLayout(result.metrics, `${viewport.name} postgres long-data`);
      assert.ok(
        result.metrics.tableWraps.every((tableWrap) => tableWrap.containsOverflow),
        `${viewport.name} postgres table overflow should stay contained in table-wrap: ${JSON.stringify(result.metrics.tableWraps)}`
      );
    }
  } finally {
    if (campaignId) {
      await cleanupCampaign(`http://127.0.0.1:${server.address().port}`, campaignId);
    }

    client.close();
    await chrome.close();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function inspectViewport({ client, viewport, url, waitFor }) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile
  });
  await client.send('Page.navigate', { url });
  await waitForExpression(client, `document.readyState === 'complete'`);
  await authenticateAdminUi(client);
  await client.send('Page.reload');
  await waitForExpression(client, waitFor);

  const metrics = await evaluate(client, layoutMetricsExpression());
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  });

  return {
    metrics,
    screenshot: screenshot.data
  };
}

async function authenticateAdminUi(client) {
  await evaluate(
    client,
    `localStorage.setItem('cloak-admin-token', ${JSON.stringify(adminToken)})`
  );
}

function layoutMetricsExpression() {
  return `(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth
    );
    const viewportWidth = document.documentElement.clientWidth;
    const undersizedTouchTargets = Array.from(document.querySelectorAll('button, a, input, select'))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0 &&
          (rect.width < 44 || rect.height < 44);
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: element.className,
          text: element.textContent.trim().slice(0, 24),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      });
    const tableWraps = Array.from(document.querySelectorAll('.table-wrap')).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        containsOverflow: element.scrollWidth > element.clientWidth
      };
    });

    return {
      viewportWidth,
      documentWidth,
      hasPageOverflow: documentWidth > viewportWidth + 1,
      undersizedTouchTargets,
      tableWraps
    };
  })()`;
}

function assertHealthyLayout(metrics, label) {
  assert.equal(
    metrics.hasPageOverflow,
    false,
    `${label} overflowed horizontally: ${JSON.stringify(metrics)}`
  );
  assert.deepEqual(
    metrics.undersizedTouchTargets,
    [],
    `${label} has touch targets smaller than 44px`
  );
}

async function seedLongCampaign(baseUrl, {
  name = '超长链接布局回归活动'
} = {}) {
  const longSuffix = 'utm_source=' + 'very-long-source-value-'.repeat(12);
  const response = await fetch(`${baseUrl}/api/v1/campaigns`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      safeUrl: `https://safe.example/path/to/a/very/deep/resource/${'safe-segment-'.repeat(16)}?${longSuffix}`,
      moneyUrl: `https://money.example/offers/${'money-segment-'.repeat(18)}?${longSuffix}`,
      redirectMode: 'redirect'
    })
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Failed to seed campaign');
  }

  await fetch(`${baseUrl}/c/${payload.data.id}`, {
    redirect: 'manual',
    headers: {
      'user-agent': 'Mozilla/5.0 BrowserLayoutCheck'
    }
  });

  return payload.data.id;
}

async function cleanupCampaign(baseUrl, campaignId) {
  const headers = {
    Authorization: `Bearer ${adminToken}`
  };

  await fetch(`${baseUrl}/api/v1/campaigns/${campaignId}/logs`, {
    method: 'DELETE',
    headers
  });
  await fetch(`${baseUrl}/api/v1/campaigns/${campaignId}`, {
    method: 'DELETE',
    headers
  });
}

async function waitForExpression(client, expression) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const value = await evaluate(client, expression).catch(() => false);

    if (value) {
      return;
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });

  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text);
  }

  return response.result.value;
}

async function launchChrome(chromePath) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'cloak-chrome-'));
  const child = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], {
    stdio: 'ignore',
    windowsHide: true
  });

  const debugPort = await waitForDebugPort(userDataDir, child);
  const webSocketDebuggerUrl = await waitForPageWebSocket(debugPort);

  return {
    webSocketDebuggerUrl,
    async close() {
      await stopChromeProcessTree(child);
      await rm(userDataDir, { recursive: true, force: true });
    }
  };
}

async function stopChromeProcessTree(child) {
  if (child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true
    }).catch(() => {
      child.kill();
    });
  } else {
    child.kill('SIGTERM');
  }

  if (child.exitCode === null) {
    await Promise.race([
      once(child, 'exit'),
      delay(3000)
    ]);
  }
}

async function waitForDebugPort(userDataDir, child) {
  const portFile = path.join(userDataDir, 'DevToolsActivePort');

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Chrome exited early with code ${child.exitCode}`);
    }

    if (existsSync(portFile)) {
      const [port] = String(await readFile(portFile, 'utf8')).split(/\r?\n/);
      return port;
    }

    await delay(100);
  }

  throw new Error('Timed out waiting for Chrome DevTools port.');
}

async function waitForPageWebSocket(debugPort) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');

      if (page?.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome may need another moment before DevTools HTTP is ready.
    }

    await delay(100);
  }

  throw new Error('Timed out waiting for Chrome page target.');
}

function findChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

class CdpClient {
  constructor(webSocket) {
    this.webSocket = webSocket;
    this.nextId = 1;
    this.pending = new Map();

    webSocket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);

      if (!message.id) {
        return;
      }

      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message));
        return;
      }

      pending.resolve(message.result);
    });
  }

  static async connect(webSocketDebuggerUrl) {
    const webSocket = new WebSocket(webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      webSocket.addEventListener('open', resolve, { once: true });
      webSocket.addEventListener('error', reject, { once: true });
    });
    return new CdpClient(webSocket);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;

    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.webSocket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    this.webSocket.close();
  }
}
