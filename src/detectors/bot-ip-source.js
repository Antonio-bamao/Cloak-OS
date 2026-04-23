export class InMemoryBotIpSource {
  constructor({ botIps = [] } = {}) {
    this.botIps = new Set(botIps);
  }

  async load(botIps) {
    this.botIps = new Set(botIps);
  }

  async has(ip) {
    return this.botIps.has(ip);
  }
}

export function createBotIpSource({ type = 'memory', botIps = [] } = {}) {
  if (type === 'memory') {
    return new InMemoryBotIpSource({ botIps });
  }

  throw new Error(`Unsupported bot IP source: ${type}`);
}
