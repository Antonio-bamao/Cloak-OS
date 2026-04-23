export class IframeStrategy {
  async execute(targetUrl) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html><head><meta charset="utf-8"><title></title></head><body style="margin:0"><iframe src="${escapeAttribute(targetUrl)}" style="border:0;width:100vw;height:100vh"></iframe></body></html>`
    };
  }
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
