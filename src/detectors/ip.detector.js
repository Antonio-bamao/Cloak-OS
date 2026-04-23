import { BaseDetector } from './base.detector.js';
import { createBotIpSource } from './bot-ip-source.js';

export class IpDetector extends BaseDetector {
  constructor({ botIps = [], botIpSource } = {}) {
    super();
    this.botIpSource = botIpSource ?? createBotIpSource({ botIps });
  }

  get name() {
    return 'ip';
  }

  async detect(ctx) {
    if (await this.botIpSource.has(ctx.ip)) {
      return {
        isBot: true,
        confidence: 95,
        reason: 'IP matched configured bot source'
      };
    }

    return {
      isBot: false,
      confidence: 0,
      reason: 'IP not found in bot source'
    };
  }
}
