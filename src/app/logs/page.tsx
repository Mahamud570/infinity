'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ChevronLeft, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

type Log = {
  id: string;
  timestamp: string;
  modelUsed: string;
  keyIndexUsed: number;
  latencyMs: number;
  success: boolean;
  errorMessage: string | null;
  promptLength: number | null;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    checkAuthAndFetchLogs();
  }, []);

  const checkAuthAndFetchLogs = async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      if (!authRes.ok) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setError('');
      } else {
        setError('Failed to fetch logs.');
      }
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Activity className="text-purple-500" />
              Inference Logs
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={checkAuthAndFetchLogs} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm font-medium">
              Refresh Logs
            </button>
          </div>
        </div>

        {error && <div className="text-red-400 bg-red-400/10 p-4 rounded-lg border border-red-500/20">{error}</div>}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/50 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Model</th>
                  <th className="px-6 py-4 font-medium">Key Index</th>
                  <th className="px-6 py-4 font-medium">Latency (ms)</th>
                  <th className="px-6 py-4 font-medium">Prompt Length</th>
                  <th className="px-6 py-4 font-medium">Error Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        {log.success ? (
                          <CheckCircle size={18} className="text-emerald-500" />
                        ) : (
                          <XCircle size={18} className="text-red-500" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-blue-400">
                        {log.modelUsed || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {log.keyIndexUsed !== null ? `Key [${log.keyIndexUsed}]` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-400">
                        {log.latencyMs}ms
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-400">
                        {log.promptLength || 0} chars
                      </td>
                      <td className="px-6 py-4 text-xs text-red-300 max-w-xs truncate">
                        {log.errorMessage || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
