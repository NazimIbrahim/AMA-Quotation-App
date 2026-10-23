import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { Database, Download, RefreshCw, AlertTriangle, CheckCircle2, History } from 'lucide-react';

export const BackupRestorePage: React.FC = () => {
  const { fetchApi } = useServer();
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/api/backup/list');
      setBackups(res.backups || []);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetchApi('/api/backup/create', { method: 'POST' });
      setMessage({ text: `Backup created: ${res.backup.filename} (${res.backup.sizeFormatted})`, type: 'success' });
      loadBackups();
    } catch (err: any) {
      setMessage({ text: err.message || 'Backup failed', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    const confirm = window.confirm(
      `CAUTION: Restoring database from '${filename}' will overwrite current business records with the backup state. Proceed?`
    );
    if (!confirm) return;

    setRestoring(filename);
    setMessage(null);
    try {
      await fetchApi('/api/backup/restore', {
        method: 'POST',
        body: JSON.stringify({ filename }),
      });
      setMessage({ text: `Database restored successfully from '${filename}'.`, type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Restore failed', type: 'error' });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-w-5xl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">PostgreSQL Database Backups & Recovery</h1>
          <p className="text-xs text-gray-500">
            Create on-demand SQL snapshots and restore full database state in disaster recovery scenarios
          </p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="btn btn-primary btn-sm flex items-center space-x-1"
        >
          <Database size={14} />
          <span>{creating ? 'Creating Snapshot...' : 'Create Backup Now'}</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-xs flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Safety Notice */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start space-x-3 text-xs text-amber-800">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Automated Central Storage & Safety Verification</p>
          <p className="text-[11px] text-amber-700 mt-1">
            Backups are generated directly using PostgreSQL native pg_dump and stored on the central server. Client PCs
            do not hold database binaries, maintaining strict zero-bloat client footprint.
          </p>
        </div>
      </div>

      {/* Backup Files Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center">
          <span className="text-xs font-bold text-primary uppercase tracking-wide">
            Available Database Snapshots
          </span>
          <button onClick={loadBackups} className="btn btn-secondary btn-sm py-0.5 text-xs flex items-center space-x-1">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-600 font-semibold">
                <th className="py-2.5 px-3">Snapshot Filename</th>
                <th className="py-2.5 px-3">Created At</th>
                <th className="py-2.5 px-3 text-right">File Size</th>
                <th className="py-2.5 px-3 text-center">Restore Database</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">Loading backup list...</td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    No backup files found. Click "Create Backup Now" above to take a database snapshot.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono font-medium text-gray-900">{b.filename}</td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {new Date(b.createdAt).toLocaleString('en-GB')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-800">{b.sizeFormatted}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleRestore(b.filename)}
                        disabled={restoring === b.filename}
                        className="btn btn-danger btn-sm py-0.5 px-2 text-[11px]"
                      >
                        {restoring === b.filename ? 'Restoring...' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
