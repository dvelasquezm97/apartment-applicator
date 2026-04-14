import type { Application } from '../../src/types/application.js';

export const sampleApplication: Application = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  listingId: '550e8400-e29b-41d4-a716-446655440001',
  status: 'APPLYING',
  retryCount: 0,
  timeline: [
    { status: 'APPLYING', timestamp: '2026-04-14T10:05:00Z', note: 'Application started' },
  ],
  createdAt: '2026-04-14T10:05:00Z',
  updatedAt: '2026-04-14T10:05:00Z',
};
