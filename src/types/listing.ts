export interface Listing {
  id: string;
  immoscoutId: string;
  url: string;
  title: string;
  address: string | null;
  rent: number | null;
  size: number | null;
  rooms: number | null;
  discoveredAt: string;
  status: 'active' | 'delisted';
}
