import { useStats } from '../hooks/useApi.js';

const STATUS_LABELS: Record<string, string> = {
  APPLYING: 'Applying',
  APPLIED: 'Applied',
  FAILED: 'Failed',
  DOCUMENTS_REQUESTED: 'Docs Requested',
  DOCUMENTS_SENT: 'Docs Sent',
  VIEWING_INVITED: 'Viewing Invited',
  VIEWING_SCHEDULED: 'Viewing Scheduled',
  EXTERNAL_FORM_DETECTED: 'External Form',
  CLOSED: 'Closed',
};

export function Dashboard() {
  const { data, isLoading, error } = useStats();

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Applications" value={data.applications.total} />
        <StatCard label="Listings Found" value={data.listings.total} />
        <StatCard label="Documents" value={data.documents.total} />
        <StatCard label="Today's Apps" value={data.daily.applicationsToday} />
      </div>

      {/* Automation status */}
      <div className={`rounded-lg p-4 mb-8 ${data.daily.automationPaused ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${data.daily.automationPaused ? 'bg-red-500' : 'bg-green-500'}`} />
          <span className="font-medium">
            Automation: {data.daily.automationPaused ? 'PAUSED' : 'RUNNING'}
          </span>
        </div>
        {data.messages.unprocessed > 0 && (
          <p className="text-sm text-orange-600 mt-2">{data.messages.unprocessed} unprocessed message(s)</p>
        )}
      </div>

      {/* Applications by status */}
      {Object.keys(data.applications.byStatus).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Applications by Status</h3>
          <div className="bg-white rounded-lg border divide-y">
            {Object.entries(data.applications.byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between px-4 py-2">
                <span className="text-gray-700">{STATUS_LABELS[status] || status}</span>
                <span className="font-mono font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
