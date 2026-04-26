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
    assert.match(html, /环境变量修改后需要重启服务/);
    assert.doesNotMatch(html, /premium-card|Go Premium|Live shield insights/);
    assert.doesNotMatch(html, /Premium|SaaS|trial|Broker|Create New|Overview|Campaigns|Access Logs/);
    assert.match(html, /\/admin\/styles.css/);
    assert.match(html, /\/admin\/app.js/);

    const cssResponse = await fetch(`http://127.0.0.1:${port}/admin/styles.css`);
    assert.equal(cssResponse.status, 200);
    assert.match(cssResponse.headers.get('content-type'), /text\/css/);
    const css = await cssResponse.text();
    assert.match(css, /--color-primary/);
    assert.match(css, /--surface-elevated/);
    assert.match(css, /conic-gradient/);
    assert.match(css, /backdrop-filter/);
    assert.match(css, /\.error-banner/);
    assert.match(css, /\.empty-state/);
    assert.match(css, /touch-action: manipulation/);
    assert.match(css, /-webkit-overflow-scrolling: touch/);
    assert.match(css, /@media \(max-width: 520px\)/);
    assert.match(css, /\.support-list\s*\{[^}]*display: none/s);
    assert.match(css, /\.metrics-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
    assert.match(css, /\.token-form\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) 44px/s);

    const jsResponse = await fetch(`http://127.0.0.1:${port}/admin/app.js`);
    assert.equal(jsResponse.status, 200);
    assert.match(jsResponse.headers.get('content-type'), /javascript/);
    const js = await jsResponse.text();
    assert.match(js, /loadOverview/);
    assert.match(js, /loadSettings/);
    assert.match(js, /renderSettings/);
    assert.match(js, /\/api\/v1\/settings/);
    assert.match(js, /botIpCount/);
    assert.match(js, /showSuccessModal/);
    assert.match(js, /renderErrorBanner/);
    assert.match(js, /hideErrorBanner/);
    assert.match(js, /handleUiError/);
    assert.match(js, /emptyState/);
    assert.match(js, /暂无匹配记录/);
    assert.doesNotMatch(js, /Premium|Campaign updated|Campaign created|operation board|Save Campaign|Update Campaign/);
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
