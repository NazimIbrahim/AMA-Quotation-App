import React, { useState } from 'react';
import { useServer } from '../context/ServerContext';
import { BarChart3, Download, FileSpreadsheet, Calendar, CheckCircle2 } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { serverUrl } = useServer();
  const token = localStorage.getItem('ama_token');

  // Quotation export filters
  const [qStatus, setQStatus] = useState('');
  const [qStartDate, setQStartDate] = useState('');
  const [qEndDate, setQEndDate] = useState('');

  // Payment export filters
  const [pStartDate, setPStartDate] = useState('');
  const [pEndDate, setPEndDate] = useState('');

  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const handleDownload = async (type: 'quotations' | 'payments', format: 'xlsx' | 'csv') => {
    const key = `${type}-${format}`;
    setExportingKey(key);
    const params = new URLSearchParams({ format });
    if (type === 'quotations') {
      if (qStatus) params.append('status', qStatus);
      if (qStartDate) params.append('start_date', qStartDate);
      if (qEndDate) params.append('end_date', qEndDate);
    } else {
      if (pStartDate) params.append('start_date', pStartDate);
      if (pEndDate) params.append('end_date', pEndDate);
    }

    const downloadUrl = `${serverUrl}/api/reports/${type}/export?${params.toString()}`;
    const filename = `${type}_export_${new Date().toISOString().split('T')[0]}.${format}`;

    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.downloadFile(downloadUrl, filename);
        if (res.success) {
          alert(`Export saved successfully to:\n${res.filePath}`);
        } else if (res.error && res.error !== 'Canceled by user') {
          alert('Export failed: ' + res.error);
        }
      } else {
        const res = await fetch(downloadUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 lg:space-y-6 overflow-y-auto w-full min-w-0">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reports & Data Exports</h1>
        <p className="text-xs text-gray-500">
          Stream comprehensive financial statements and quotation datasets directly into Excel (.xlsx) and CSV
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Quotations Export Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center space-x-2.5 pb-2 border-b">
            <div className="p-2 bg-blue-50 text-primary rounded">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Quotations Register Export</h2>
              <p className="text-[11px] text-gray-500">All customer quotations, area totals, taxes & status</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Filter by Status</label>
              <select className="input input-sm" value={qStatus} onChange={(e) => setQStatus(e.target.value)}>
                <option value="">All Statuses (Draft, In-Review, Approved, Closed, Rejected)</option>
                <option value="draft">Draft</option>
                <option value="in_review">In-Review</option>
                <option value="approved">Approved</option>
                <option value="closed">Closed / Paid</option>
                <option value="not_closed">Not Closed (Active Pipeline)</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">From Date</label>
                <input
                  type="date"
                  className="input input-sm"
                  value={qStartDate}
                  onChange={(e) => setQStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">To Date</label>
                <input
                  type="date"
                  className="input input-sm"
                  value={qEndDate}
                  onChange={(e) => setQEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-3 border-t border-[#E0E1DD]">
              <button
                onClick={() => handleDownload('quotations', 'xlsx')}
                disabled={exportingKey !== null}
                className={`btn btn-primary btn-sm flex-1 flex items-center justify-center space-x-1 ${
                  exportingKey === 'quotations-xlsx' ? 'btn-exporting' : ''
                }`}
              >
                <Download size={13} className={exportingKey === 'quotations-xlsx' ? 'animate-bounce' : ''} />
                <span>{exportingKey === 'quotations-xlsx' ? 'Exporting Excel...' : 'Download Excel (.xlsx)'}</span>
              </button>
              <button
                onClick={() => handleDownload('quotations', 'csv')}
                disabled={exportingKey !== null}
                className={`btn btn-secondary btn-sm flex-1 flex items-center justify-center space-x-1 ${
                  exportingKey === 'quotations-csv' ? 'btn-exporting' : ''
                }`}
              >
                <Download size={13} className={exportingKey === 'quotations-csv' ? 'animate-bounce' : ''} />
                <span>{exportingKey === 'quotations-csv' ? 'Exporting CSV...' : 'Download CSV'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Payments Collections Export Card */}
        <div className="card card-hover p-5 space-y-4">
          <div className="flex items-center space-x-2.5 pb-2 border-b border-[#E0E1DD]">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0D1B2A]">Collections & Receipts Register</h2>
              <p className="text-[11px] text-[#415A77]">Detailed payment log with transaction IDs & payment modes</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#1B263B] font-semibold mb-1">From Date</label>
                <input
                  type="date"
                  className="input input-sm"
                  value={pStartDate}
                  onChange={(e) => setPStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[#1B263B] font-semibold mb-1">To Date</label>
                <input
                  type="date"
                  className="input input-sm"
                  value={pEndDate}
                  onChange={(e) => setPEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="p-3 bg-[#F8F9FA] rounded border border-[#E0E1DD] text-[#415A77] text-[11px] space-y-1">
              <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 size={13} />
                <span>Audited Transaction Integrity</span>
              </div>
              <p>Includes receipt number, client, cheque/NEFT ref, amount, and clearing status.</p>
            </div>

            <div className="flex space-x-2 pt-3 border-t border-[#E0E1DD]">
              <button
                onClick={() => handleDownload('payments', 'xlsx')}
                disabled={exportingKey !== null}
                className={`btn btn-primary btn-sm flex-1 flex items-center justify-center space-x-1 ${
                  exportingKey === 'payments-xlsx' ? 'btn-exporting' : ''
                }`}
              >
                <Download size={13} className={exportingKey === 'payments-xlsx' ? 'animate-bounce' : ''} />
                <span>{exportingKey === 'payments-xlsx' ? 'Exporting Excel...' : 'Download Excel (.xlsx)'}</span>
              </button>
              <button
                onClick={() => handleDownload('payments', 'csv')}
                disabled={exportingKey !== null}
                className={`btn btn-secondary btn-sm flex-1 flex items-center justify-center space-x-1 ${
                  exportingKey === 'payments-csv' ? 'btn-exporting' : ''
                }`}
              >
                <Download size={13} className={exportingKey === 'payments-csv' ? 'animate-bounce' : ''} />
                <span>{exportingKey === 'payments-csv' ? 'Exporting CSV...' : 'Download CSV'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
