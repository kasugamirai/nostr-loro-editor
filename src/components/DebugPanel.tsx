/**
 * Debug Panel Component
 *
 * Displays sync metrics and allows running latency tests.
 */

import { useState, useEffect, useCallback } from 'react';
import type { LoroNostrProvider } from '@/lib/loro-nostr-provider';
import type { SyncMetrics } from '@/types';
import clsx from 'clsx';

interface DebugPanelProps {
  docId: string;
  provider: LoroNostrProvider | null;
  isConnected: boolean;
  className?: string;
}

export function DebugPanel({ docId, provider, isConnected, className }: DebugPanelProps) {
  const [metrics, setMetrics] = useState<SyncMetrics | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [lastPongLatency, setLastPongLatency] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Subscribe to metrics updates
  useEffect(() => {
    if (!provider) return;

    const handleMetrics = (data: unknown) => {
      setMetrics(data as SyncMetrics);
    };

    const handlePong = (data: unknown) => {
      const { latency } = data as { latency: number };
      setLastPongLatency(latency);
    };

    provider.on('metrics', handleMetrics);
    provider.on('pong', handlePong);

    // Get initial metrics
    setMetrics(provider.getMetrics());

    return () => {
      provider.off('metrics', handleMetrics);
      provider.off('pong', handlePong);
    };
  }, [provider]);

  // Single ping
  const handlePing = useCallback(async () => {
    if (!provider || isTestRunning) return;
    setLastPongLatency(null);
    await provider.ping();
  }, [provider, isTestRunning]);

  // Run latency test
  const handleRunTest = useCallback(async () => {
    if (!provider || isTestRunning) return;

    setIsTestRunning(true);
    setTestProgress(0);

    const totalPings = 10;
    for (let i = 0; i < totalPings; i++) {
      await provider.ping();
      setTestProgress(((i + 1) / totalPings) * 100);
      await new Promise(r => setTimeout(r, 500));
    }

    setMetrics(provider.getMetrics());
    setIsTestRunning(false);
  }, [provider, isTestRunning]);

  // Reset metrics
  const handleReset = useCallback(() => {
    if (!provider) return;
    provider.resetMetrics();
    setMetrics(provider.getMetrics());
    setLastPongLatency(null);
  }, [provider]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={clsx(
          'fixed bottom-4 right-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg',
          'text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors',
          'shadow-lg z-50',
          className
        )}
      >
        📊 Debug
      </button>
    );
  }

  return (
    <div
      className={clsx(
        'fixed bottom-4 right-4 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-200">📊 Sync Debug Panel</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <span
            className={clsx('w-2 h-2 rounded-full', {
              'bg-green-500': isConnected,
              'bg-red-500': !isConnected,
            })}
          />
          <span className="text-sm">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {metrics && (
            <span className="text-xs text-gray-400">
              ({metrics.connectedRelays}/{metrics.totalRelays} relays)
            </span>
          )}
        </div>

        {/* Latency Stats */}
        {metrics && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-400 uppercase">Latency</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-gray-700/50 rounded">
                <div className="text-xs text-gray-400">Last</div>
                <div className="font-mono text-lg">
                  {lastPongLatency !== null ? `${lastPongLatency}ms` : metrics.lastLatency ? `${metrics.lastLatency}ms` : '-'}
                </div>
              </div>
              <div className="p-2 bg-gray-700/50 rounded">
                <div className="text-xs text-gray-400">Average</div>
                <div className="font-mono text-lg">
                  {metrics.avgLatency ? `${metrics.avgLatency}ms` : '-'}
                </div>
              </div>
              <div className="p-2 bg-gray-700/50 rounded">
                <div className="text-xs text-gray-400">Min</div>
                <div className="font-mono">
                  {metrics.minLatency !== Infinity ? `${metrics.minLatency}ms` : '-'}
                </div>
              </div>
              <div className="p-2 bg-gray-700/50 rounded">
                <div className="text-xs text-gray-400">Max</div>
                <div className="font-mono">
                  {metrics.maxLatency ? `${metrics.maxLatency}ms` : '-'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Message Stats */}
        {metrics && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-400 uppercase">Messages</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-gray-700/50 rounded">
                <div className="text-xs text-gray-400">Sent</div>
                <div className="font-mono">{metrics.messagesSent}</div>
              </div>
              <div className="p-2 bg-gray-700/50 rounded">
                <div className="text-xs text-gray-400">Received</div>
                <div className="font-mono">{metrics.messagesReceived}</div>
              </div>
              <div className="p-2 bg-gray-700/50 rounded">
                <div className="text-xs text-gray-400">Bytes Sent</div>
                <div className="font-mono text-xs">{formatBytes(metrics.bytesSent)}</div>
              </div>
              <div className="p-2 bg-gray-700/50 rounded">
                <div className="text-xs text-gray-400">Bytes Recv</div>
                <div className="font-mono text-xs">{formatBytes(metrics.bytesReceived)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Latency Chart (simple) */}
        {metrics && metrics.measurements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-400 uppercase">
              History ({metrics.measurements.length} samples)
            </h4>
            <div className="h-16 flex items-end gap-px bg-gray-700/30 rounded p-1">
              {metrics.measurements.slice(-30).map((m, i) => {
                const maxLatency = Math.max(...metrics.measurements.map(m => m.latency || 0));
                const height = maxLatency > 0 ? ((m.latency || 0) / maxLatency) * 100 : 0;
                return (
                  <div
                    key={i}
                    className={clsx('flex-1 rounded-t transition-all', {
                      'bg-green-500': (m.latency || 0) < 200,
                      'bg-yellow-500': (m.latency || 0) >= 200 && (m.latency || 0) < 500,
                      'bg-red-500': (m.latency || 0) >= 500,
                    })}
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${m.latency}ms`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Test Progress */}
        {isTestRunning && (
          <div className="space-y-1">
            <div className="text-xs text-gray-400">Running test...</div>
            <div className="h-2 bg-gray-700 rounded overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all"
                style={{ width: `${testProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handlePing}
            disabled={!isConnected || isTestRunning}
            className={clsx(
              'flex-1 py-2 rounded text-sm font-medium transition-colors',
              isConnected && !isTestRunning
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            )}
          >
            Ping
          </button>
          <button
            onClick={handleRunTest}
            disabled={!isConnected || isTestRunning}
            className={clsx(
              'flex-1 py-2 rounded text-sm font-medium transition-colors',
              isConnected && !isTestRunning
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            )}
          >
            {isTestRunning ? 'Testing...' : 'Run Test'}
          </button>
          <button
            onClick={handleReset}
            disabled={isTestRunning}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Document ID */}
        <div className="pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-500">
            Doc: <code className="text-gray-400">{docId.slice(0, 20)}...</code>
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility function
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default DebugPanel;
