export const DOCUMENT_TYPES = [
  'CV',
  'INCOME_PROOF',
  'COVER_LETTER',
  'SCHUFA',
  'OTHER',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface UserDocument {
  id: string;
  userId: string;
  type: DocumentType;
  filename: string;
  storageKey: string;
  uploadedAt: string;
}
