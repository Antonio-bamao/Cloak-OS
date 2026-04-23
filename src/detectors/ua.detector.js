import { BaseDetector } from './base.detector.js';

const CRAWLER_SIGNATURES = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /bingpreview/i
];

export class UserAgentDetector extends BaseDetector {
  get name() {
    return 'ua';
  }

  async detect(ctx) {
    const userAgent = ctx.userAgent ?? '';
    const matched = CRAWLER_SIGNATURES.some((signature) => signature.test(userAgent));

    if (matched) {
      return {
        isBot: true,
        confidence: 90,
        reason: 'User-Agent matched crawler signature'
      };
    }

    return {
      isBot: false,
      confidence: 0,
      reason: 'User-Agent did not match crawler signature'
    };
  }
}
