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
    assert.match(html, /\/admin\/styles.css/);
    assert.match(html, /\/admin\/app.js/);

    const cssResponse = await fetch(`http://127.0.0.1:${port}/admin/styles.css`);
    assert.equal(cssResponse.status, 200);
    assert.match(cssResponse.headers.get('content-type'), /text\/css/);
    assert.match(await cssResponse.text(), /--color-primary/);

    const jsResponse = await fetch(`http://127.0.0.1:${port}/admin/app.js`);
    assert.equal(jsResponse.status, 200);
    assert.match(jsResponse.headers.get('content-type'), /javascript/);
    assert.match(await jsResponse.text(), /loadOverview/);
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
