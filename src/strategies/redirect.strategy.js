export class RedirectStrategy {
  async execute(targetUrl) {
    return {
      statusCode: 302,
      headers: { Location: targetUrl },
      body: ''
    };
  }
}
