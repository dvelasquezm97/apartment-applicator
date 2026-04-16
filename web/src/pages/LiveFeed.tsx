import { useEffect, useRef } from 'react';
import { useWebSocket, type ListingResultUpdate } from '../hooks/useWebSocket.js';
import { useStopApply, useApplyStatus } from '../hooks/useApi.js';

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  scraping: 'Scraping listings...',
  applying: 'Applying...',
  paused: 'Paused (CAPTCHA)',
  done: 'Done',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-700',
  scraping: 'bg-blue-100 text-blue-700',
  applying: 'bg-yellow-100 text-yellow-800',
  paused: 'bg-orange-100 text-orange-800',
  done: 'bg-green-100 text-green-700',
};

function ResultIcon({ status }: { status: ListingResultUpdate['status'] }) {
  switch (status) {
    case 'success':
      return <span className="text-green-600 flex-shrink-0">{'\u2705'}</span>;
    case 'failed':
      return <span className="text-red-600 flex-shrink-0">{'\u274C'}</span>;
    case 'skipped':
    case 'already-applied':
      return <span className="text-gray-400 flex-shrink-0">{'\u23ED\uFE0F'}</span>;
    default:
      return null;
  }
}

function ResultLabel({ status }: { status: ListingResultUpdate['status'] }) {
  switch (status) {
    case 'success':
      return <span className="text-green-700 font-medium">Applied</span>;
    case 'failed':
      return <span className="text-red-700 font-medium">Failed</span>;
    case 'skipped':
      return <span className="text-gray-500 font-medium">Skipped</span>;
    case 'already-applied':
      return <span className="text-gray-500 font-medium">Already applied</span>;
    default:
      return null;
  }
}

export function LiveFeed() {
  const { progress, listingResults, connected } = useWebSocket();
  const { data: applyStatus } = useApplyStatus();
  const stopApply = useStopApply();
  const listEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new results arrive
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [listingResults.length]);

  const extensionConnected = applyStatus?.extensionConnected ?? false;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Live Feed</h2>
        <div className="flex items-center gap-3">
          {/* Extension status */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                extensionConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-gray-500">
              Extension {extensionConnected ? 'connected' : 'disconnected'}
            </span>
          </div>

          {/* WebSocket status */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                connected ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
            <span className="text-xs text-gray-500">
              {connected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{progress.applied}</p>
          <p className="text-sm text-gray-500">Applied</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{progress.failed}</p>
          <p className="text-sm text-gray-500">Failed</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-3xl font-bold text-gray-500">{progress.skipped}</p>
          <p className="text-sm text-gray-500">Skipped</p>
        </div>
      </div>

      {/* Status + current listing */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                STATUS_COLORS[progress.status] ?? STATUS_COLORS.idle
              }`}
            >
              {STATUS_LABELS[progress.status] ?? progress.status}
            </span>
            {progress.currentListing && (
              <span className="text-sm text-gray-600 truncate max-w-xs">
                {progress.currentListing}
              </span>
            )}
          </div>
          <button
            onClick={() => stopApply.mutate()}
            disabled={stopApply.isPending || progress.status === 'idle' || progress.status === 'done'}
            className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {stopApply.isPending ? 'Stopping...' : 'Stop'}
          </button>
        </div>
      </div>

      {/* Results list */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-sm text-gray-700">
            Results ({listingResults.length})
          </h3>
        </div>

        {listingResults.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-gray-400 text-sm">
              {progress.status === 'idle'
                ? 'No active session. Start applying from the dashboard or onboarding.'
                : 'Waiting for results...'}
            </p>
          </div>
        ) : (
          <div className="divide-y max-h-[60vh] overflow-y-auto">
            {listingResults.map((result, index) => (
              <div key={`${result.listingId}-${index}`} className="px-4 py-3 flex items-start gap-3">
                <ResultIcon status={result.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ResultLabel status={result.status} />
                    <span className="text-sm text-gray-700 truncate">{result.title}</span>
                  </div>
                  {result.reason && (
                    <p className="text-xs text-gray-400 mt-0.5">{result.reason}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={listEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
