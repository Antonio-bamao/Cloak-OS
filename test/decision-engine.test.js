import test from 'node:test';
import assert from 'node:assert/strict';

import { DecisionEngine } from '../src/core/decision-engine.js';

test('DecisionEngine sends confident bot traffic to the safe action', () => {
  const engine = new DecisionEngine({ suspiciousThreshold: 60, botThreshold: 80 });

  const decision = engine.decide([
    { detector: 'ip', isBot: true, confidence: 95, reason: 'IP matched' },
    { detector: 'ua', isBot: false, confidence: 0, reason: 'UA clean' }
  ]);

  assert.deepEqual(decision, {
    verdict: 'bot',
    action: 'safe',
    confidence: 95,
    reasons: ['ip: IP matched']
  });
});

test('DecisionEngine marks medium-confidence bot signals as suspicious', () => {
  const engine = new DecisionEngine({ suspiciousThreshold: 60, botThreshold: 80 });

  const decision = engine.decide([
    { detector: 'ua', isBot: true, confidence: 65, reason: 'weak crawler signal' }
  ]);

  assert.deepEqual(decision, {
    verdict: 'suspicious',
    action: 'safe',
    confidence: 65,
    reasons: ['ua: weak crawler signal']
  });
});

test('DecisionEngine sends clean traffic to the money action', () => {
  const engine = new DecisionEngine();

  const decision = engine.decide([
    { detector: 'ip', isBot: false, confidence: 0, reason: 'clean' }
  ]);

  assert.deepEqual(decision, {
    verdict: 'human',
    action: 'money',
    confidence: 0,
    reasons: []
  });
});
