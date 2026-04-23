export class DetectionPipeline {
  constructor() {
    this.detectors = [];
  }

  register(detector) {
    if (!detector || typeof detector.detect !== 'function') {
      throw new TypeError('Detector must implement detect(ctx)');
    }

    this.detectors.push(detector);
    return this;
  }

  async execute(ctx) {
    const results = await Promise.all(
      this.detectors.map(async (detector) => {
        const result = await detector.detect(ctx);
        return normalizeDetectionResult(detector.name, result);
      })
    );

    return results;
  }
}

function normalizeDetectionResult(detectorName, result) {
  if (!result || typeof result !== 'object') {
    throw new TypeError(`Detector ${detectorName} returned an invalid result`);
  }

  return {
    detector: detectorName,
    isBot: Boolean(result.isBot),
    confidence: Number(result.confidence ?? 0),
    reason: String(result.reason ?? '')
  };
}
