import { useEffect, useRef } from 'react';
import { useWebSocket, type ListingResultUpdate } from '../hooks/useWebSocket.js';
import { useStopApply, useStartApply, useApplyStatus, useStats } from '../hooks/useApi.js';

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  scraping: 'Scanning listings...',
  applying: 'Applying to apartments...',
  paused: 'Paused — CAPTCHA detected. Please solve it in your browser.',
  done: 'Session complete',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-700',
  scraping: 'bg-blue-100 text-blue-700',
  applying: 'bg-green-100 text-green-700',
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
  const { data: stats } = useStats();
  const startApply = useStartApply();
  const stopApply = useStopApply();
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [listingResults.length]);

  const extensionConnected = applyStatus?.extensionConnected ?? false;
  const isRunning = progress.status !== 'idle' && progress.status !== 'done';
  const isIdle = progress.status === 'idle' || progress.status === 'done';
  const dailyUsed = stats?.daily.applicationsToday ?? 0;
  const dailyCap = stats?.daily.dailyCap ?? 20;
  const capReached = dailyUsed >= dailyCap;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Live Feed</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${extensionConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500">
              Extension {extensionConnected ? 'connected' : 'disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-xs text-gray-500">{connected ? 'Live' : 'Reconnecting...'}</span>
          </div>
        </div>
      </div>

      {/* Daily usage bar */}
      {stats && (
        <div className="bg-white rounded-lg border p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Daily applications</span>
            <span className={`text-sm font-semibold ${capReached ? 'text-orange-600' : 'text-gray-600'}`}>
              {dailyUsed} / {dailyCap}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${capReached ? 'bg-orange-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, (dailyUsed / dailyCap) * 100)}%` }}
            />
          </div>
          {capReached && (
            <p className="text-xs text-orange-600 mt-2">
              Daily limit reached. The counter resets automatically tomorrow.
            </p>
          )}
        </div>
      )}

      {/* Action card — Start or Status */}
      {isIdle && (
        <div className="bg-white rounded-lg border p-8 mb-6 text-center">
          {!extensionConnected ? (
            <>
              <div className="text-red-500 text-4xl mb-3">{'🔌'}</div>
              <h3 className="text-lg font-semibold mb-2">Extension not connected</h3>
              <p className="text-gray-500 text-sm mb-4">
                Make sure the BerlinKeys Chrome extension is installed and shows "Connected" in its popup.
                Open any Immoscout24 page to activate it.
              </p>
            </>
          ) : capReached ? (
            <>
              <div className="text-4xl mb-3">{'🛑'}</div>
              <h3 className="text-lg font-semibold mb-2">Daily limit reached</h3>
              <p className="text-gray-500 text-sm mb-4">
                You've applied to {dailyUsed} apartments today (limit: {dailyCap}).
                The counter resets automatically tomorrow to avoid triggering Immoscout rate limits.
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-3">{'🏠'}</div>
              <h3 className="text-lg font-semibold mb-2">Ready to apply</h3>
              <p className="text-gray-500 text-sm mb-6">
                The extension is connected. Click below to start scanning your search and applying to new apartments automatically.
              </p>
              <button
                onClick={() => startApply.mutate()}
                disabled={startApply.isPending}
                className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startApply.isPending ? 'Starting...' : 'Start Applying'}
              </button>
              {startApply.isError && (
                <p className="text-red-500 text-sm mt-3">
                  {(startApply.error as Error)?.message || 'Failed to start'}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Stats bar */}
      {(isRunning || listingResults.length > 0) && (
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
      )}

      {/* Status bar + Stop button */}
      {isRunning && (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${STATUS_COLORS[progress.status] ?? STATUS_COLORS.idle}`}>
                {STATUS_LABELS[progress.status] ?? progress.status}
              </span>
              {progress.currentListing && (
                <span className="text-sm text-gray-600 truncate max-w-md">
                  {progress.currentListing}
                </span>
              )}
            </div>
            <button
              onClick={() => stopApply.mutate()}
              disabled={stopApply.isPending}
              className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {stopApply.isPending ? 'Stopping...' : 'Stop'}
            </button>
          </div>
        </div>
      )}

      {/* Done summary */}
      {progress.status === 'done' && listingResults.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-green-800">Session complete</h3>
              <p className="text-sm text-green-700">
                Applied to {progress.applied} apartments. {progress.failed > 0 ? `${progress.failed} failed. ` : ''}
                {progress.skipped > 0 ? `${progress.skipped} skipped (already applied).` : ''}
              </p>
            </div>
            {!capReached && (
              <button
                onClick={() => startApply.mutate()}
                disabled={startApply.isPending || !extensionConnected}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Run Again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results list */}
      {listingResults.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-sm text-gray-700">Results ({listingResults.length})</h3>
          </div>
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
        </div>
      )}
    </div>
  );
}
