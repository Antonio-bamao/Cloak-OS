export class BaseDetector {
  async detect() {
    throw new Error('Must implement detect()');
  }

  get name() {
    throw new Error('Must implement name getter');
  }
}
