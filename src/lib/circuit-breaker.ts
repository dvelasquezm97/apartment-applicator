import { createChildLogger } from './logger.js';

const log = createChildLogger('circuit-breaker');

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  threshold: number;
  openDurationMs: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureAt: Date | null = null;
  private openedAt: Date | null = null;

  constructor(
    private readonly scope: string,
    private readonly config: CircuitBreakerConfig,
  ) {}

  getState(): CircuitState {
    if (this.state === 'OPEN' && this.openedAt) {
      const elapsed = Date.now() - this.openedAt.getTime();
      if (elapsed >= this.config.openDurationMs) {
        this.state = 'HALF_OPEN';
        log.info({ scope: this.scope }, 'Circuit breaker transitioned to HALF_OPEN');
      }
    }
    return this.state;
  }

  isOpen(): boolean {
    return this.getState() === 'OPEN';
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      log.info({ scope: this.scope }, 'Circuit breaker closed after successful probe');
    }
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureAt = null;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureAt = new Date();

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.config.threshold) {
      this.state = 'OPEN';
      this.openedAt = new Date();
      log.warn(
        { scope: this.scope, failureCount: this.failureCount },
        'Circuit breaker OPENED',
      );
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureAt = null;
    this.openedAt = null;
    log.info({ scope: this.scope }, 'Circuit breaker manually reset');
  }

  getInfo() {
    return {
      scope: this.scope,
      state: this.getState(),
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureAt?.toISOString() ?? null,
      openedAt: this.openedAt?.toISOString() ?? null,
    };
  }
}
