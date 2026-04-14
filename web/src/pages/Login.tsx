export function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center mb-6">BerlinKeys</h1>
        <p className="text-gray-500 text-center mb-4">Sign in to your dashboard</p>
        {/* TODO: Supabase Auth login form (magic link or email/password) */}
        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          Sign In
        </button>
      </div>
    </div>
  );
}
