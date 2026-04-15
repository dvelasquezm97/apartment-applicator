import { useState } from 'react';
import { useApplications, useApplicationMessages } from '../hooks/useApi.js';
import { StatusBadge } from '../components/StatusBadge.js';

export function Applications() {
  const { data, isLoading, error } = useApplications();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {(error as Error).message}</div>;

  const applications = data?.applications || [];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Applications ({applications.length})</h2>

      {applications.length === 0 ? (
        <p className="text-gray-500">No applications yet. The listing monitor will create them automatically.</p>
      ) : (
        <div className="space-y-2">
          {applications.map(app => (
            <div key={app.id} className="bg-white rounded-lg border">
              <button
                className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                onClick={() => setSelectedId(selectedId === app.id ? null : app.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{app.listing?.title || 'Unknown listing'}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {app.listing?.address || ''}{app.listing?.rent ? ` — ${app.listing.rent}\u20AC` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <StatusBadge status={app.status} />
                  <span className="text-xs text-gray-400">{new Date(app.createdAt).toLocaleDateString('de-DE')}</span>
                </div>
              </button>

              {selectedId === app.id && (
                <div className="border-t px-4 py-3 bg-gray-50">
                  {app.listing?.url && (
                    <a href={app.listing.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block mb-3">
                      View on Immoscout
                    </a>
                  )}

                  <h4 className="text-sm font-semibold mb-2">Timeline</h4>
                  <div className="space-y-1 mb-4">
                    {(app.timeline || []).map((entry, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-gray-400 font-mono text-xs whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </span>
                        <StatusBadge status={entry.status} />
                        {entry.note && <span className="text-gray-600 truncate">{entry.note}</span>}
                      </div>
                    ))}
                  </div>

                  <ApplicationMessages applicationId={app.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationMessages({ applicationId }: { applicationId: string }) {
  const { data, isLoading } = useApplicationMessages(applicationId);

  if (isLoading) return <p className="text-sm text-gray-400">Loading messages...</p>;
  const messages = data?.messages || [];
  if (messages.length === 0) return <p className="text-sm text-gray-400">No messages yet.</p>;

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Messages ({messages.length})</h4>
      <div className="space-y-2">
        {messages.map(msg => (
          <div key={msg.id} className={`text-sm p-2 rounded ${msg.direction === 'INBOUND' ? 'bg-white border' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="flex justify-between mb-1">
              <span className="text-xs font-medium">{msg.direction === 'INBOUND' ? 'Landlord' : 'You'}</span>
              <span className="text-xs text-gray-400">{new Date(msg.receivedAt).toLocaleString('de-DE')}</span>
            </div>
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
