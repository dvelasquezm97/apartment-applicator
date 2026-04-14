// TODO: In-memory Redis mock for testing

export function createMockRedis() {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => { store.set(key, value); return 'OK'; },
    del: async (key: string) => { store.delete(key); return 1; },
    ping: async () => 'PONG',
    quit: async () => {},
  };
}
