import type { InboxMessage } from '../../src/types/message.js';

export const documentRequestMessage: InboxMessage = {
  id: '550e8400-e29b-41d4-a716-446655440020',
  applicationId: '550e8400-e29b-41d4-a716-446655440010',
  direction: 'INBOUND',
  content: 'Vielen Dank für Ihre Anfrage. Bitte senden Sie uns folgende Unterlagen zu: Gehaltsnachweis, SCHUFA-Auskunft, Personalausweis.',
  receivedAt: '2026-04-14T12:00:00Z',
  processedAt: null,
};

export const viewingInviteMessage: InboxMessage = {
  id: '550e8400-e29b-41d4-a716-446655440021',
  applicationId: '550e8400-e29b-41d4-a716-446655440010',
  direction: 'INBOUND',
  content: 'Wir laden Sie herzlich zur Besichtigung ein am 20.04.2026 um 14:00 Uhr. Adresse: Oranienstraße 42, 10999 Berlin.',
  receivedAt: '2026-04-14T14:00:00Z',
  processedAt: null,
};

export const externalFormMessage: InboxMessage = {
  id: '550e8400-e29b-41d4-a716-446655440022',
  applicationId: '550e8400-e29b-41d4-a716-446655440010',
  direction: 'INBOUND',
  content: 'Bitte füllen Sie unser Bewerbungsformular aus: https://forms.example.com/apply/abc123',
  receivedAt: '2026-04-14T15:00:00Z',
  processedAt: null,
};

export const rejectionMessage: InboxMessage = {
  id: '550e8400-e29b-41d4-a716-446655440023',
  applicationId: '550e8400-e29b-41d4-a716-446655440010',
  direction: 'INBOUND',
  content: 'Leider müssen wir Ihnen mitteilen, dass die Wohnung bereits vergeben wurde.',
  receivedAt: '2026-04-14T16:00:00Z',
  processedAt: null,
};
