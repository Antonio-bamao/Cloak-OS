import { readFileSync } from 'node:fs';

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

  list() {
    return [...this.botIps];
  }

  get count() {
    return this.botIps.size;
  }
}

export class FileBotIpSource extends InMemoryBotIpSource {
  constructor({
    filePath,
    readFile = (path) => readFileSync(path, 'utf8')
  } = {}) {
    if (!filePath) {
      throw new TypeError('FileBotIpSource requires filePath');
    }

    const botIps = parseBotIpFile(readFile(filePath));
    super({ botIps });
    this.filePath = filePath;
    this.readFile = readFile;
  }

  async reload() {
    const botIps = parseBotIpFile(await this.readFile(this.filePath));
    await this.load(botIps);

    return {
      count: this.count,
      botIps: this.list()
    };
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
  filePath,
  readFile,
  redisClient,
  redisKey
} = {}) {
  if (type === 'memory' || type === 'env') {
    return new InMemoryBotIpSource({ botIps });
  }

  if (type === 'file') {
    return new FileBotIpSource({ filePath, readFile });
  }

  if (type === 'redis') {
    return new RedisBotIpSource({
      client: redisClient,
      key: redisKey
    });
  }

  throw new Error(`Unsupported bot IP source: ${type}`);
}

export function parseBotIpFile(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}
