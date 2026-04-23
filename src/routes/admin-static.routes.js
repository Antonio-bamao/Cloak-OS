import { readFile } from 'node:fs/promises';

const ADMIN_ROOT = new URL('../../public/admin/', import.meta.url);

export function createAdminStaticRoutes({ root = ADMIN_ROOT } = {}) {
  return {
    'GET /admin': staticAsset(root, 'index.html', 'text/html; charset=utf-8'),
    'GET /admin/': staticAsset(root, 'index.html', 'text/html; charset=utf-8'),
    'GET /admin/styles.css': staticAsset(root, 'styles.css', 'text/css; charset=utf-8'),
    'GET /admin/app.js': staticAsset(root, 'app.js', 'text/javascript; charset=utf-8')
  };
}

function staticAsset(root, filename, contentType) {
  return async () => ({
    statusCode: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    },
    body: await readFile(new URL(filename, root), 'utf8')
  });
}
