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

export class RedisBotIpSource {
  constructor({ client, key = 'cloak:bot-ips' } = {}) {
    if (!client) {
      throw new TypeError('RedisBotIpSource requires a Redis-like client');
    }

    this.client = client;
    this.key = key;
  }

  async load(botIps) {
    if (typeof this.client.del === 'function') {
      await this.client.del(this.key);
    }

    if (botIps.length > 0 && typeof this.client.sAdd === 'function') {
      await this.client.sAdd(this.key, botIps);
    }
  }

  async has(ip) {
    const result = await this.client.sIsMember(this.key, ip);
    return Boolean(result);
  }
}

export function createBotIpSource({
  type = 'memory',
  botIps = [],
  redisClient,
  redisKey
} = {}) {
  if (type === 'memory') {
    return new InMemoryBotIpSource({ botIps });
  }

  if (type === 'redis') {
    return new RedisBotIpSource({
      client: redisClient,
      key: redisKey
    });
  }

  throw new Error(`Unsupported bot IP source: ${type}`);
}
