import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings, useUpdateProfile } from '../hooks/useApi.js';

const PROFILE_FIELDS = [
  { key: 'name', label: 'Full Name', type: 'text' },
  { key: 'phone', label: 'Phone Number', type: 'tel' },
  { key: 'dob', label: 'Date of Birth', type: 'text', placeholder: 'DD.MM.YYYY' },
  { key: 'nationality', label: 'Nationality', type: 'text' },
  { key: 'occupation', label: 'Occupation', type: 'text' },
  { key: 'employer', label: 'Employer', type: 'text' },
  { key: 'income', label: 'Monthly Net Income (EUR)', type: 'number' },
  { key: 'moveInDate', label: 'Desired Move-in Date', type: 'text', placeholder: 'DD.MM.YYYY' },
  { key: 'numberOfPersons', label: 'Number of Persons', type: 'number' },
] as const;

export function Settings() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [searchUrl, setSearchUrl] = useState('');
  const [searchUrlSaved, setSearchUrlSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setEmail(settings.immoscoutEmail || '');
      setProfile(settings.profile || {});
      setSearchUrl(settings.searchUrl || '');
    }
  }, [settings]);

  if (isLoading) return <div className="p-4">Loading...</div>;

  const handleSaveCredentials = async () => {
    const data: any = { immoscoutEmail: email };
    if (password) data.immoscoutPassword = password;
    await updateSettings.mutateAsync(data);
    setPassword('');
  };

  const handleSaveProfile = async () => {
    await updateProfile.mutateAsync(profile);
  };

  const handleSaveSearchUrl = async () => {
    setSearchUrlSaved(false);
    await updateSettings.mutateAsync({ searchUrl });
    setSearchUrlSaved(true);
  };

  const handleTogglePause = async () => {
    await updateSettings.mutateAsync({ automationPaused: !settings?.automationPaused });
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Settings</h2>

      {/* Automation toggle */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Automation</h3>
            <p className="text-sm text-gray-500">Pause or resume all automated actions</p>
          </div>
          <button
            onClick={handleTogglePause}
            className={`px-4 py-2 rounded font-medium text-sm ${
              settings?.automationPaused
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
            disabled={updateSettings.isPending}
          >
            {settings?.automationPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Immoscout Credentials */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-3">Immoscout24 Credentials</h3>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleSaveCredentials}
            disabled={updateSettings.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Saving...' : 'Save Credentials'}
          </button>
          {updateSettings.isSuccess && <span className="text-sm text-green-600 ml-2">Saved!</span>}
        </div>
      </div>

      {/* Search URL */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-1">Search URL</h3>
        <p className="text-sm text-gray-500 mb-3">Your Immoscout24 search URL — BerlinKeys monitors this for new listings.</p>
        <div className="space-y-3 max-w-2xl">
          <input
            type="url"
            value={searchUrl}
            onChange={e => { setSearchUrl(e.target.value); setSearchUrlSaved(false); }}
            placeholder="https://www.immobilienscout24.de/Suche/..."
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveSearchUrl}
              disabled={updateSettings.isPending || !searchUrl}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {updateSettings.isPending ? 'Saving...' : 'Save Search URL'}
            </button>
            {searchUrlSaved && <span className="text-sm text-green-600">Saved!</span>}
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-3">Application Profile</h3>
        <p className="text-sm text-gray-500 mb-4">This data is used to fill application forms automatically.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          {PROFILE_FIELDS.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <input
                type={field.type}
                value={profile[field.key] ?? ''}
                onChange={e => setProfile({ ...profile, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                placeholder={'placeholder' in field ? field.placeholder : undefined}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleSaveProfile}
          disabled={updateProfile.isPending}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
        </button>
        {updateProfile.isSuccess && <span className="text-sm text-green-600 ml-2">Saved!</span>}
      </div>
    </div>
  );
}
