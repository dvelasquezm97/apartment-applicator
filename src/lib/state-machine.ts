import type { ApplicationStatus, TimelineEntry } from '../types/application.js';
import { VALID_TRANSITIONS, MAX_RETRY_COUNT } from '../types/application.js';
import { InvalidTransitionError, MaxRetriesExceededError } from './errors.js';

export interface TransitionResult {
  newStatus: ApplicationStatus;
  timelineEntry: TimelineEntry;
  retryCount: number;
}

/**
 * Validate and execute an application status transition.
 * This is the ONLY code path that should change application status.
 * Invalid transitions throw InvalidTransitionError.
 */
export function transition(
  currentStatus: ApplicationStatus,
  targetStatus: ApplicationStatus,
  retryCount: number,
  note?: string,
): TransitionResult {
  // Special case: FAILED → APPLYING (retry)
  if (currentStatus === 'FAILED' && targetStatus === 'APPLYING') {
    if (retryCount >= MAX_RETRY_COUNT) {
      throw new MaxRetriesExceededError(`retry_count=${retryCount}`);
    }
    return {
      newStatus: 'APPLYING',
      timelineEntry: {
        status: 'APPLYING',
        timestamp: new Date().toISOString(),
        note: note ?? `Retry attempt ${retryCount + 1}/${MAX_RETRY_COUNT}`,
      },
      retryCount: retryCount + 1,
    };
  }

  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new InvalidTransitionError(currentStatus, targetStatus);
  }

  return {
    newStatus: targetStatus,
    timelineEntry: {
      status: targetStatus,
      timestamp: new Date().toISOString(),
      note,
    },
    retryCount,
  };
}

/**
 * Check if a transition is valid without executing it.
 */
export function canTransition(
  currentStatus: ApplicationStatus,
  targetStatus: ApplicationStatus,
  retryCount: number,
): boolean {
  if (currentStatus === 'FAILED' && targetStatus === 'APPLYING') {
    return retryCount < MAX_RETRY_COUNT;
  }
  const allowed = VALID_TRANSITIONS[currentStatus];
  return !!allowed && allowed.includes(targetStatus);
}
