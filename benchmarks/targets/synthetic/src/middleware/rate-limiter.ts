import { MAX_BATCH_SIZE } from '../config.js';

interface RateLimiterState {
  tokens: number;
  lastRefill: number;
  requestsPerSecond: number;
}

export function createRateLimiter(
  requestsPerSecond: number,
): (fn: () => Promise<unknown>) => Promise<unknown> {
  const effectiveRate = Math.min(requestsPerSecond, MAX_BATCH_SIZE);

  const state: RateLimiterState = {
    tokens: effectiveRate,
    lastRefill: Date.now(),
    requestsPerSecond: effectiveRate,
  };

  return async (fn: () => Promise<unknown>): Promise<unknown> => {
    refillTokens(state);

    if (state.tokens <= 0) {
      const waitTime = calculateWaitTime(state);
      await delay(waitTime);
      refillTokens(state);
    }

    state.tokens--;
    return fn();
  };
}

function refillTokens(state: RateLimiterState): void {
  const now = Date.now();
  const elapsed = now - state.lastRefill;
  const tokensToAdd = Math.floor(
    (elapsed / 1000) * state.requestsPerSecond,
  );

  if (tokensToAdd > 0) {
    state.tokens = Math.min(
      state.tokens + tokensToAdd,
      state.requestsPerSecond,
    );
    state.lastRefill = now;
  }
}

function calculateWaitTime(state: RateLimiterState): number {
  const tokensNeeded = 1;
  const timePerToken = 1000 / state.requestsPerSecond;
  return Math.ceil(tokensNeeded * timePerToken);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateEffectiveRate(
  requestedRate: number,
): number {
  if (requestedRate <= 0) return 1;
  return Math.min(requestedRate, MAX_BATCH_SIZE);
}

export function estimateThroughput(
  itemCount: number,
  ratePerSecond: number,
): { estimatedSeconds: number; batches: number } {
  const effectiveRate = calculateEffectiveRate(ratePerSecond);
  const batches = Math.ceil(itemCount / effectiveRate);
  const estimatedSeconds = batches;

  return { estimatedSeconds, batches };
}
