import { RedirectStrategy } from './redirect.strategy.js';
import { IframeStrategy } from './iframe.strategy.js';
import { LoadingStrategy } from './loading.strategy.js';

const strategies = {
  redirect: RedirectStrategy,
  iframe: IframeStrategy,
  loading: LoadingStrategy
};

export function getRedirectStrategy(mode = 'redirect') {
  const Strategy = strategies[mode];

  if (!Strategy) {
    throw new Error(`Unsupported redirect mode: ${mode}`);
  }

  return new Strategy();
}
