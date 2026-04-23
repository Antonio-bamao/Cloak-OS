import { BaseDetector } from './base.detector.js';

export class IpDetector extends BaseDetector {
  constructor({ botIps = [] } = {}) {
    super();
    this.botIps = new Set(botIps);
  }

  get name() {
    return 'ip';
  }

  async detect(ctx) {
    if (this.botIps.has(ctx.ip)) {
      return {
        isBot: true,
        confidence: 95,
        reason: 'IP matched configured bot list'
      };
    }

    return {
      isBot: false,
      confidence: 0,
      reason: 'IP not found in bot list'
    };
  }
}
