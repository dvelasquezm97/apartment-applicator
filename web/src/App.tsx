import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { Dashboard } from './pages/Dashboard.js';
import { Applications } from './pages/Applications.js';
import { Documents } from './pages/Documents.js';
import { Settings } from './pages/Settings.js';
import { Onboarding } from './pages/Onboarding.js';
import { LiveFeed } from './pages/LiveFeed.js';
import { useSettings } from './hooks/useApi.js';

function AppRoutes() {
  const { data: settings, isLoading } = useSettings();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const onboardingComplete = settings?.onboardingComplete ?? false;

  return (
    <Routes>
      {/* Onboarding — full-screen, no sidebar */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Main app with sidebar layout */}
      <Route element={<Layout />}>
        <Route
          path="/"
          element={onboardingComplete ? <Dashboard /> : <Navigate to="/onboarding" replace />}
        />
        <Route path="/applications" element={<Applications />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/live" element={<LiveFeed />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return <AppRoutes />;
}
