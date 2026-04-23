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
    assert.match(html, /总览/);
    assert.match(html, /活动列表/);
    assert.match(html, /访问日志/);
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

    const jsResponse = await fetch(`http://127.0.0.1:${port}/admin/app.js`);
    assert.equal(jsResponse.status, 200);
    assert.match(jsResponse.headers.get('content-type'), /javascript/);
    const js = await jsResponse.text();
    assert.match(js, /loadOverview/);
    assert.match(js, /showSuccessModal/);
    assert.doesNotMatch(js, /Premium|Campaign updated|Campaign created|operation board|Save Campaign|Update Campaign/);
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
