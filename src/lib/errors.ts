export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Invalid status transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class MaxRetriesExceededError extends Error {
  constructor(public readonly applicationId: string) {
    super(`Max retries exceeded for application ${applicationId}`);
    this.name = 'MaxRetriesExceededError';
  }
}

export class CaptchaDetectedError extends Error {
  constructor(public readonly userId: string) {
    super(`CAPTCHA detected for user ${userId}`);
    this.name = 'CaptchaDetectedError';
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly userId: string,
    public readonly scope: string,
  ) {
    super(`Circuit breaker open for user ${userId} (${scope})`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}
