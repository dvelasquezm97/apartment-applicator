import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../../src/lib/circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker('test', { threshold: 3, openDurationMs: 1000 });
    expect(cb.getState()).toBe('CLOSED');
  });

  it('opens after threshold failures', () => {
    const cb = new CircuitBreaker('test', { threshold: 3, openDurationMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED');
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
  });

  it('resets on manual reset', () => {
    const cb = new CircuitBreaker('test', { threshold: 1, openDurationMs: 60000 });
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('closes on success after being half-open', () => {
    const cb = new CircuitBreaker('test', { threshold: 1, openDurationMs: 0 });
    cb.recordFailure();
    // With openDurationMs=0, should transition to HALF_OPEN immediately
    expect(cb.getState()).toBe('HALF_OPEN');
    cb.recordSuccess();
    expect(cb.getState()).toBe('CLOSED');
  });
});
