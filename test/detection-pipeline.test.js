import test from 'node:test';
import assert from 'node:assert/strict';

import { BaseDetector } from '../src/detectors/base.detector.js';
import { DetectionPipeline } from '../src/core/pipeline.js';

test('BaseDetector enforces the detector contract', async () => {
  const detector = new BaseDetector();

  assert.throws(() => detector.name, /must implement name/i);
  await assert.rejects(() => detector.detect({}), /must implement detect/i);
});

test('DetectionPipeline registers independent detectors and preserves result order', async () => {
  class FirstDetector extends BaseDetector {
    get name() {
      return 'first';
    }

    async detect(ctx) {
      return { isBot: false, confidence: 10, reason: `ip:${ctx.ip}` };
    }
  }

  class SecondDetector extends BaseDetector {
    get name() {
      return 'second';
    }

    async detect() {
      return { isBot: true, confidence: 90, reason: 'known bot' };
    }
  }

  const pipeline = new DetectionPipeline();
  pipeline.register(new FirstDetector());
  pipeline.register(new SecondDetector());

  const results = await pipeline.execute({ ip: '203.0.113.10' });

  assert.deepEqual(results, [
    { detector: 'first', isBot: false, confidence: 10, reason: 'ip:203.0.113.10' },
    { detector: 'second', isBot: true, confidence: 90, reason: 'known bot' }
  ]);
});
