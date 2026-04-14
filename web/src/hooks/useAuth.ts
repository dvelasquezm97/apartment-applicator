// TODO: Supabase Auth hook

export function useAuth() {
  // TODO: Return { user, session, signIn, signOut, loading }
  return {
    user: null,
    session: null,
    loading: false,
    signIn: async () => {},
    signOut: async () => {},
  };
}
