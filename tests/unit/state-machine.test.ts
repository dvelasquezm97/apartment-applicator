import { describe, it, expect } from 'vitest';
import { transition, canTransition } from '../../src/lib/state-machine.js';
import { InvalidTransitionError, MaxRetriesExceededError } from '../../src/lib/errors.js';

describe('State Machine', () => {
  describe('valid transitions', () => {
    it('APPLYING → APPLIED', () => {
      const result = transition('APPLYING', 'APPLIED', 0);
      expect(result.newStatus).toBe('APPLIED');
      expect(result.timelineEntry.status).toBe('APPLIED');
    });

    it('APPLYING → FAILED', () => {
      const result = transition('APPLYING', 'FAILED', 0);
      expect(result.newStatus).toBe('FAILED');
    });

    it('APPLIED → DOCUMENTS_REQUESTED', () => {
      const result = transition('APPLIED', 'DOCUMENTS_REQUESTED', 0);
      expect(result.newStatus).toBe('DOCUMENTS_REQUESTED');
    });

    it('APPLIED → VIEWING_INVITED', () => {
      const result = transition('APPLIED', 'VIEWING_INVITED', 0);
      expect(result.newStatus).toBe('VIEWING_INVITED');
    });

    it('APPLIED → CLOSED', () => {
      const result = transition('APPLIED', 'CLOSED', 0);
      expect(result.newStatus).toBe('CLOSED');
    });

    it('APPLIED → EXTERNAL_FORM_DETECTED', () => {
      const result = transition('APPLIED', 'EXTERNAL_FORM_DETECTED', 0);
      expect(result.newStatus).toBe('EXTERNAL_FORM_DETECTED');
    });

    it('FAILED → APPLYING (retry)', () => {
      const result = transition('FAILED', 'APPLYING', 1);
      expect(result.newStatus).toBe('APPLYING');
      expect(result.retryCount).toBe(2);
    });
  });

  describe('invalid transitions', () => {
    it('APPLYING → CLOSED throws', () => {
      expect(() => transition('APPLYING', 'CLOSED', 0)).toThrow(InvalidTransitionError);
    });

    it('CLOSED → APPLYING throws', () => {
      expect(() => transition('CLOSED', 'APPLYING', 0)).toThrow(InvalidTransitionError);
    });

    it('APPLIED → APPLYING throws', () => {
      expect(() => transition('APPLIED', 'APPLYING', 0)).toThrow(InvalidTransitionError);
    });
  });

  describe('max retries', () => {
    it('FAILED → APPLYING throws when retryCount >= 3', () => {
      expect(() => transition('FAILED', 'APPLYING', 3)).toThrow(MaxRetriesExceededError);
    });
  });

  describe('canTransition', () => {
    it('returns true for valid transitions', () => {
      expect(canTransition('APPLYING', 'APPLIED', 0)).toBe(true);
    });

    it('returns false for invalid transitions', () => {
      expect(canTransition('APPLYING', 'CLOSED', 0)).toBe(false);
    });

    it('returns false for retry at max count', () => {
      expect(canTransition('FAILED', 'APPLYING', 3)).toBe(false);
    });
  });
});
