export class InMemoryRateLimiter {
  constructor({
    limit,
    windowMs,
    now = Date.now
  }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.buckets = new Map();
  }

  consume(key) {
    const currentTime = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || currentTime >= bucket.resetAt) {
      this.buckets.set(key, {
        count: 1,
        resetAt: currentTime + this.windowMs
      });
      return { allowed: true };
    }

    if (bucket.count < this.limit) {
      bucket.count += 1;
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000))
    };
  }
}
