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

  const handleDownload = (type: 'quotations' | 'payments', format: 'xlsx' | 'csv') => {
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

    // Trigger download
    fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => alert('Export failed: ' + err.message));
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reports & Data Exports</h1>
        <p className="text-xs text-gray-500">
          Stream comprehensive financial statements and quotation datasets directly into Excel (.xlsx) and CSV
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
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

            <div className="flex space-x-2 pt-3 border-t">
              <button
                onClick={() => handleDownload('quotations', 'xlsx')}
                className="btn btn-primary btn-sm flex-1 flex items-center justify-center space-x-1"
              >
                <Download size={13} />
                <span>Download Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => handleDownload('quotations', 'csv')}
                className="btn btn-secondary btn-sm flex-1 flex items-center justify-center space-x-1"
              >
                <Download size={13} />
                <span>Download CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Payments Collections Export Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center space-x-2.5 pb-2 border-b">
            <div className="p-2 bg-green-50 text-green-700 rounded">
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Collections & Receipts Register</h2>
              <p className="text-[11px] text-gray-500">Detailed payment log with transaction IDs & payment modes</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">From Date</label>
                <input
                  type="date"
                  className="input input-sm"
                  value={pStartDate}
                  onChange={(e) => setPStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">To Date</label>
                <input
                  type="date"
                  className="input input-sm"
                  value={pEndDate}
                  onChange={(e) => setPEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded border text-gray-600 text-[11px] space-y-1">
              <div className="flex items-center space-x-1.5 text-green-700 font-medium">
                <CheckCircle2 size={13} />
                <span>Audited Transaction Integrity</span>
              </div>
              <p>Includes receipt number, client, cheque/NEFT ref, amount, and clearing status.</p>
            </div>

            <div className="flex space-x-2 pt-3 border-t">
              <button
                onClick={() => handleDownload('payments', 'xlsx')}
                className="btn btn-primary btn-sm flex-1 flex items-center justify-center space-x-1"
              >
                <Download size={13} />
                <span>Download Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => handleDownload('payments', 'csv')}
                className="btn btn-secondary btn-sm flex-1 flex items-center justify-center space-x-1"
              >
                <Download size={13} />
                <span>Download CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
