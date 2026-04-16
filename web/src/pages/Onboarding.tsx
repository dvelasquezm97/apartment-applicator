import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useSettings,
  useUpdateProfile,
  useUpdateSettings,
  useApplyStatus,
  useStartApply,
} from '../hooks/useApi.js';

const STEPS = ['Profile', 'Search URL', 'Extension', 'Start Applying'] as const;

const PROFILE_FIELDS = [
  { key: 'name', label: 'Full Name', type: 'text', required: true },
  { key: 'phone', label: 'Phone Number', type: 'tel', required: true },
  { key: 'street', label: 'Street', type: 'text', required: true },
  { key: 'houseNumber', label: 'House Number', type: 'text', required: true },
  { key: 'zipCode', label: 'Zip Code', type: 'text', required: true },
  { key: 'city', label: 'City', type: 'text', required: true },
  { key: 'occupation', label: 'Occupation', type: 'text', required: true },
  { key: 'income', label: 'Monthly Net Income (EUR)', type: 'number', required: true },
] as const;

export function Onboarding() {
  const navigate = useNavigate();
  const { data: settings, isLoading } = useSettings();
  const updateProfile = useUpdateProfile();
  const updateSettings = useUpdateSettings();
  const { data: applyStatus, refetch: refetchStatus } = useApplyStatus();
  const startApply = useStartApply();

  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Record<string, string | number>>({});
  const [searchUrl, setSearchUrl] = useState('');
  const [searchUrlError, setSearchUrlError] = useState('');
  const [extensionChecked, setExtensionChecked] = useState(false);
  const [startError, setStartError] = useState('');

  // Pre-fill from existing data
  useEffect(() => {
    if (settings) {
      if (settings.profile && Object.keys(settings.profile).length > 0) {
        setProfile(settings.profile);
      }
      if (settings.searchUrl) {
        setSearchUrl(settings.searchUrl);
      }
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const handleSaveProfile = async () => {
    await updateProfile.mutateAsync(profile);
    setStep(1);
  };

  const handleSaveSearchUrl = async () => {
    setSearchUrlError('');
    if (!searchUrl.includes('immobilienscout24.de/Suche')) {
      setSearchUrlError('This does not look like an Immoscout search URL. It should contain "immobilienscout24.de/Suche".');
      return;
    }
    await updateSettings.mutateAsync({ searchUrl });
    setStep(2);
  };

  const handleCheckConnection = async () => {
    const result = await refetchStatus();
    if (result.data?.extensionConnected) {
      setExtensionChecked(true);
    } else {
      setExtensionChecked(false);
    }
  };

  const handleStartApplying = async () => {
    setStartError('');
    try {
      await updateSettings.mutateAsync({ onboardingComplete: true });
      await startApply.mutateAsync();
      navigate('/live');
    } catch (err) {
      setStartError((err as Error).message || 'Failed to start. Make sure the extension is connected.');
    }
  };

  const profileComplete = PROFILE_FIELDS.filter((f) => f.required).every(
    (f) => profile[f.key] !== undefined && profile[f.key] !== '',
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold">BerlinKeys Setup</h1>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 w-full max-w-lg">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-1 ${
                  i < step
                    ? 'bg-green-600 text-white'
                    : i === step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? '\u2713' : i + 1}
              </div>
              <span className={`text-xs ${i === step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="w-full max-w-lg">
          {/* Step 1: Profile */}
          {step === 0 && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-1">Your Profile</h2>
              <p className="text-sm text-gray-500 mb-6">
                This information is used to fill apartment application forms automatically.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PROFILE_FIELDS.map((field) => (
                  <div key={field.key} className={field.key === 'name' ? 'sm:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <input
                      type={field.type}
                      value={profile[field.key] ?? ''}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          [field.key]:
                            field.type === 'number' ? Number(e.target.value) : e.target.value,
                        })
                      }
                      className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={!profileComplete || updateProfile.isPending}
                  className="bg-blue-600 text-white px-6 py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateProfile.isPending ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Search URL */}
          {step === 1 && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-1">Your Search URL</h2>
              <p className="text-sm text-gray-500 mb-4">
                BerlinKeys uses your Immoscout search to find new apartments.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">How to get your search URL:</h3>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Go to <span className="font-medium">immobilienscout24.de</span></li>
                  <li>Search for apartments with your criteria (location, rooms, price, etc.)</li>
                  <li>Copy the URL from your browser's address bar</li>
                  <li>Paste it below</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search URL</label>
                <input
                  type="url"
                  value={searchUrl}
                  onChange={(e) => {
                    setSearchUrl(e.target.value);
                    setSearchUrlError('');
                  }}
                  placeholder="https://www.immobilienscout24.de/Suche/..."
                  className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                {searchUrlError && (
                  <p className="text-sm text-red-600 mt-1">{searchUrlError}</p>
                )}
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(0)}
                  className="text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-100"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveSearchUrl}
                  disabled={!searchUrl || updateSettings.isPending}
                  className="bg-blue-600 text-white px-6 py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateSettings.isPending ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Install Extension */}
          {step === 2 && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-1">Connect the Browser Extension</h2>
              <p className="text-sm text-gray-500 mb-4">
                The Chrome extension controls the browser to apply to apartments on your behalf.
              </p>

              <div className="bg-gray-50 border rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Installation Steps:</h3>
                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                  <li>Open Chrome and go to <span className="font-mono text-xs bg-gray-200 px-1 rounded">chrome://extensions</span></li>
                  <li>Enable <span className="font-medium">Developer mode</span> (top right toggle)</li>
                  <li>Click <span className="font-medium">Load unpacked</span></li>
                  <li>Select the <span className="font-mono text-xs bg-gray-200 px-1 rounded">extension/</span> folder from the project directory</li>
                  <li>The BerlinKeys icon should appear in your toolbar</li>
                  <li>Click the icon and make sure it says "Connected"</li>
                </ol>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={handleCheckConnection}
                  className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900"
                >
                  Check Connection
                </button>
                {extensionChecked && (
                  <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                    <span className="text-lg">{'\u2705'}</span> Extension connected
                  </span>
                )}
                {applyStatus && !applyStatus.extensionConnected && extensionChecked === false && (
                  <span className="text-sm text-gray-400">Click to check if the extension is connected</span>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-100"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="bg-blue-600 text-white px-6 py-2 rounded font-medium text-sm hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Start Applying */}
          {step === 3 && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-1">Ready to Go</h2>
              <p className="text-sm text-gray-500 mb-6">
                Review your setup and start applying to apartments.
              </p>

              {/* Summary */}
              <div className="space-y-3 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Profile</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-gray-500">Name</span>
                    <span>{profile.name || '-'}</span>
                    <span className="text-gray-500">Phone</span>
                    <span>{profile.phone || '-'}</span>
                    <span className="text-gray-500">Address</span>
                    <span>{profile.street} {profile.houseNumber}, {profile.zipCode} {profile.city}</span>
                    <span className="text-gray-500">Occupation</span>
                    <span>{profile.occupation || '-'}</span>
                    <span className="text-gray-500">Income</span>
                    <span>{profile.income ? `${profile.income} EUR` : '-'}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Search</h3>
                  <p className="text-sm text-gray-600 break-all">{searchUrl || '-'}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Extension</h3>
                  <p className="text-sm">
                    {applyStatus?.extensionConnected ? (
                      <span className="text-green-600 font-medium">{'\u2705'} Connected</span>
                    ) : (
                      <span className="text-orange-600 font-medium">Not connected — start will fail without it</span>
                    )}
                  </p>
                </div>
              </div>

              {startError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700">{startError}</p>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-100"
                >
                  Back
                </button>
                <button
                  onClick={handleStartApplying}
                  disabled={startApply.isPending}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold text-base hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {startApply.isPending ? 'Starting...' : 'Start Applying'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
