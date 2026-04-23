export class LoadingStrategy {
  async execute(targetUrl) {
    const serializedUrl = JSON.stringify(targetUrl);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<!doctype html><html><head><meta charset="utf-8"><title></title></head><body><script>setTimeout(function(){window.location.href=${serializedUrl};},800);</script></body></html>`
    };
  }
}
