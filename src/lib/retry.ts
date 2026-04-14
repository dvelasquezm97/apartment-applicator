import { JITTER_FACTOR } from '../config/constants.js';

/** Apply ±jitter to a value */
export function withJitter(value: number, factor: number = JITTER_FACTOR): number {
  const jitter = value * factor;
  return value + (Math.random() * 2 - 1) * jitter;
}

/** Random delay between min and max milliseconds */
export function randomDelay(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Sleep for a given number of milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff delay: baseMs * 2^attempt */
export function exponentialBackoff(attempt: number, baseMs: number = 1000): number {
  return baseMs * Math.pow(2, attempt);
}
