// TODO: In-memory Supabase client mock for testing

export function createMockSupabaseClient() {
  return {
    from: (table: string) => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async () => ({ data: null, error: null }),
        download: async () => ({ data: null, error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
      }),
    },
  };
}
