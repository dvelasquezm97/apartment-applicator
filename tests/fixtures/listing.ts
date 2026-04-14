import type { Listing } from '../../src/types/listing.js';

export const sampleListing: Listing = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  immoscoutId: '123456789',
  url: 'https://www.immobilienscout24.de/expose/123456789',
  title: '2-Zimmer Wohnung in Kreuzberg',
  address: 'Oranienstraße 42, 10999 Berlin',
  rent: 850,
  size: 55,
  rooms: 2,
  discoveredAt: '2026-04-14T10:00:00Z',
  status: 'active',
};

export const sampleListings: Listing[] = [
  sampleListing,
  {
    ...sampleListing,
    id: '550e8400-e29b-41d4-a716-446655440002',
    immoscoutId: '987654321',
    title: '3-Zimmer Altbau in Neukölln',
    address: 'Karl-Marx-Straße 100, 12043 Berlin',
    rent: 1100,
    size: 75,
    rooms: 3,
  },
];
