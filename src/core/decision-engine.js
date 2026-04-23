import { config } from '../config/index.js';

export class DecisionEngine {
  constructor({
    suspiciousThreshold = config.detection.suspiciousThreshold,
    botThreshold = config.detection.botThreshold
  } = {}) {
    this.suspiciousThreshold = suspiciousThreshold;
    this.botThreshold = botThreshold;
  }

  decide(results) {
    const botSignals = results.filter((result) => result.isBot);
    const confidence = botSignals.reduce(
      (max, result) => Math.max(max, result.confidence),
      0
    );
    const reasons = botSignals
      .filter((result) => result.confidence >= this.suspiciousThreshold)
      .map((result) => `${result.detector}: ${result.reason}`);

    if (confidence >= this.botThreshold) {
      return {
        verdict: 'bot',
        action: 'safe',
        confidence,
        reasons
      };
    }

    if (confidence >= this.suspiciousThreshold) {
      return {
        verdict: 'suspicious',
        action: 'safe',
        confidence,
        reasons
      };
    }

    return {
      verdict: 'human',
      action: 'money',
      confidence: 0,
      reasons: []
    };
  }
}
