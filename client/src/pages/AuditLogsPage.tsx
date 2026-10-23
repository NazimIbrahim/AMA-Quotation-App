import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { ShieldCheck, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const { fetchApi } = useServer();
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchApi(`/api/audit-logs?page=${page}&limit=30`);
      setLogs(res.auditLogs || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalLogs(res.pagination?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page]);

  return (
    <div className="flex-1 p-6 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Security & Operational Audit Trail</h1>
          <p className="text-xs text-gray-500">
            Immutable log of user logins, quotation edits, status approvals, and financial payment entries
          </p>
        </div>
        <button onClick={loadLogs} className="btn btn-secondary btn-sm flex items-center space-x-1">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-semibold">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Entity Type</th>
                <th className="py-2.5 px-3">Entity ID</th>
                <th className="py-2.5 px-3">Details</th>
                <th className="py-2.5 px-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">Loading audit logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">No audit events recorded.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-500 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-GB')}
                    </td>
                    <td className="py-2 px-3 font-semibold text-gray-800">{log.username || 'system'}</td>
                    <td className="py-2 px-3">
                      <span className="font-mono text-[11px] font-bold text-primary">{log.action}</span>
                    </td>
                    <td className="py-2 px-3 text-gray-600 capitalize">{log.entity_type}</td>
                    <td className="py-2 px-3 text-gray-500">{log.entity_id || '-'}</td>
                    <td className="py-2 px-3 text-gray-600 font-mono text-[10px] max-w-xs truncate">
                      {log.details_json ? JSON.stringify(log.details_json) : '-'}
                    </td>
                    <td className="py-2 px-3 text-gray-400 font-mono text-[10px]">{log.ip_address || 'LAN'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center text-xs text-gray-600">
          <span>Total {totalLogs} events</span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary btn-sm p-1 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-medium">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn btn-secondary btn-sm p-1 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
