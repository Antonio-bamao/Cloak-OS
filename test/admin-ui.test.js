import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/server/app.js';

test('admin UI shell and assets are served by the app', async () => {
  const app = createApp();

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const htmlResponse = await fetch(`http://127.0.0.1:${port}/admin`);

    assert.equal(htmlResponse.status, 200);
    assert.match(htmlResponse.headers.get('content-type'), /text\/html/);
    const html = await htmlResponse.text();
    assert.match(html, /id="app-shell"/);
    assert.match(html, /class="command-center"/);
    assert.match(html, /class="workspace-header"/);
    assert.match(html, /class="view-stack"/);
    assert.match(html, /class="view-panel is-active" id="overview" data-view="overview"/);
    assert.match(html, /class="view-panel" id="campaigns" data-view="campaigns"[^>]*hidden/);
    assert.match(html, /class="view-panel" id="logs" data-view="logs"[^>]*hidden/);
    assert.match(html, /class="view-panel" id="settings" data-view="settings"[^>]*hidden/);
    assert.match(html, /data-view-link="campaigns"/);
    assert.match(html, /data-view-link="logs"/);
    assert.match(html, /data-view-link="settings"/);
    assert.match(html, /class="analytics-grid"/);
    assert.match(html, /class="campaigns-layout"/);
    assert.match(html, /class="campaigns-table"/);
    assert.match(html, /class="logs-table"/);
    assert.match(html, /class="top-status"/);
    assert.match(html, /id="donut-chart"/);
    assert.match(html, /id="success-modal"/);
    assert.match(html, /id="error-banner"/);
    assert.match(html, /id="retry-error"/);
    assert.match(html, /总览/);
    assert.match(html, /活动列表/);
    assert.match(html, /访问日志/);
    assert.match(html, /href="#settings"/);
    assert.match(html, /id="settings"/);
    assert.match(html, /系统设置/);
    assert.match(html, /运行配置/);
    assert.match(html, /检测阈值/);
    assert.match(html, /重载 Bot IP/);
    assert.match(html, /文件型 Bot IP 名单可通过重载接口刷新/);
    assert.doesNotMatch(html, /premium-card|Go Premium|Live shield insights/);
    assert.doesNotMatch(html, /Premium|SaaS|trial|Broker|Create New|Overview|Campaigns|Access Logs/);
    assert.match(html, /\/admin\/styles.css/);
    assert.match(html, /\/admin\/app.js/);

    const cssResponse = await fetch(`http://127.0.0.1:${port}/admin/styles.css`);
    assert.equal(cssResponse.status, 200);
    assert.match(cssResponse.headers.get('content-type'), /text\/css/);
    const css = await cssResponse.text();
    assert.match(css, /--accent-green/);
    assert.match(css, /--accent-cyan/);
    assert.match(css, /--surface-panel/);
    assert.match(css, /conic-gradient/);
    assert.match(css, /backdrop-filter/);
    assert.match(css, /\.view-panel\[hidden\]/);
    assert.match(css, /\.analytics-grid/);
    assert.match(css, /\.campaigns-layout/);
    assert.match(css, /\.url-cell/);
    assert.match(css, /\.error-banner/);
    assert.match(css, /\.empty-state/);
    assert.match(css, /touch-action: manipulation/);
    assert.match(css, /-webkit-overflow-scrolling: touch/);
    assert.match(css, /@media \(max-width: 520px\)/);
    assert.match(css, /\.support-list\s*\{[^}]*display: none/s);
    assert.match(css, /\.metrics-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
    assert.match(css, /\.token-form\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) 44px/s);
    assert.doesNotMatch(css, /#7c3aed|#8b5cf6|#a855f7|#4c1d95/i);
    assert.doesNotMatch(css, /"Inter"|radial-gradient/);

    const jsResponse = await fetch(`http://127.0.0.1:${port}/admin/app.js`);
    assert.equal(jsResponse.status, 200);
    assert.match(jsResponse.headers.get('content-type'), /javascript/);
    const js = await jsResponse.text();
    assert.match(js, /loadOverview/);
    assert.match(js, /setActiveView/);
    assert.match(js, /viewFromHash/);
    assert.match(js, /hashchange/);
    assert.match(js, /loadSettings/);
    assert.match(js, /renderSettings/);
    assert.match(js, /\/api\/v1\/settings/);
    assert.match(js, /\/api\/v1\/settings\/bot-ips\/reload/);
    assert.match(js, /开发内存模式/);
    assert.match(js, /未连接 PostgreSQL，数据仅保存在当前进程内存/);
    assert.match(js, /botIpCount/);
    assert.match(js, /formatBotIpSource/);
    assert.match(js, /showSuccessModal/);
    assert.match(js, /renderErrorBanner/);
    assert.match(js, /hideErrorBanner/);
    assert.match(js, /handleUiError/);
    assert.match(js, /emptyState/);
    assert.match(js, /暂无匹配记录/);
    assert.doesNotMatch(js, /dev-admin-token/);
    assert.doesNotMatch(js, /本地模式/);
    assert.doesNotMatch(js, /Premium|Campaign updated|Campaign created|operation board|Save Campaign|Update Campaign/);
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
