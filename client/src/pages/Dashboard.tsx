import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  IndianRupee,
  CreditCard,
  TrendingUp,
  Award,
  RefreshCw,
  Eye,
  Printer,
  Plus,
} from 'lucide-react';
import { PdfPreviewModal } from '../components/PdfPreviewModal';

interface Props {
  onSelectQuotation: (id: number) => void;
  onCreateQuotation: () => void;
}

export const Dashboard: React.FC<Props> = ({ onSelectQuotation, onCreateQuotation }) => {
  const { fetchApi, getPdfUrl, subscribeToEvents } = useServer();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // PDF Preview State
  const [previewPdf, setPreviewPdf] = useState<{ url: string; title: string; fileName: string; quotationId?: number } | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/api/dashboard/summary');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const unsubscribe = subscribeToEvents((event) => {
      if (
        [
          'QUOTATION_CREATED',
          'QUOTATION_UPDATED',
          'QUOTATION_STATUS_CHANGED',
          'PAYMENT_RECORDED',
          'DASHBOARD_REFRESH',
        ].includes(event.type)
      ) {
        loadDashboard();
      }
    });
    return () => unsubscribe();
  }, []);

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  };

  const handleOpenPdf = (quotation: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getPdfUrl(quotation.id);
    setPreviewPdf({
      url,
      title: `Quotation ${quotation.quotation_number} — ${quotation.customer_name}`,
      fileName: `Quotation_${quotation.quotation_number}.pdf`,
      quotationId: quotation.id,
    });
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="text-center">
          <RefreshCw className="animate-spin text-slate-800 mx-auto mb-2" size={24} />
          <p className="text-xs font-medium text-slate-500">Loading Dashboard Metrics...</p>
        </div>
      </div>
    );
  }

  const statusMap: Record<string, { count: number; val: number }> = {};
  if (data?.statusCounts) {
    data.statusCounts.forEach((s: any) => {
      statusMap[s.status] = { count: parseInt(s.count, 10), val: parseFloat(s.total_val) };
    });
  }

  const totalQuotesCount = Object.values(statusMap).reduce((acc, curr) => acc + curr.count, 0) || 1;

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto max-w-7xl">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Logged in as <span className="font-semibold text-slate-800">{user?.full_name}</span> ({user?.role}) • Real-time LAN sync
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadDashboard}
            className="btn btn-secondary btn-sm"
            title="Refresh dashboard data"
          >
            <RefreshCw size={12} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onCreateQuotation}
            className="btn btn-primary btn-sm"
          >
            <Plus size={13} />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Approved Sales */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Approved Orders
            </span>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              ₹ {formatCurrency(data?.financials?.approvedRevenue)}
            </div>
            <p className="text-[10px] text-emerald-700 font-medium mt-1">
              ✓ Ready for order execution
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Payments Collected */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Payments Collected
            </span>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              ₹ {formatCurrency(data?.financials?.totalCollected)}
            </div>
            <p className="text-[10px] text-blue-700 font-medium mt-1">
              Cleared advances & settlements
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <CreditCard size={20} />
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Outstanding Balance
            </span>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              ₹ {formatCurrency(data?.financials?.totalOutstanding)}
            </div>
            <p className="text-[10px] text-amber-700 font-medium mt-1">
              Due on approved quotes
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <IndianRupee size={20} />
          </div>
        </div>

        {/* Total Quoted Pipeline */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              Total Quoted Value
            </span>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              ₹ {formatCurrency(data?.financials?.totalQuoted)}
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-1">
              Across all quotation requests
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
            <FileText size={20} />
          </div>
        </div>
      </div>

      {/* Quotation Pipeline Distribution Bar */}
      <div className="card p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Quotation Pipeline Stages
            </h2>
            <p className="text-[11px] text-slate-500">
              Distribution of quotations by lifecycle stage
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            Total {totalQuotesCount} records
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex mb-4 border border-slate-200">
          <div
            className="bg-emerald-500 h-full transition-all"
            style={{ width: `${((statusMap['approved']?.count || 0) / totalQuotesCount) * 100}%` }}
            title={`Approved: ${statusMap['approved']?.count || 0}`}
          />
          <div
            className="bg-amber-400 h-full transition-all"
            style={{ width: `${((statusMap['in_review']?.count || 0) / totalQuotesCount) * 100}%` }}
            title={`In Review: ${statusMap['in_review']?.count || 0}`}
          />
          <div
            className="bg-slate-400 h-full transition-all"
            style={{ width: `${((statusMap['draft']?.count || 0) / totalQuotesCount) * 100}%` }}
            title={`Draft: ${statusMap['draft']?.count || 0}`}
          />
          <div
            className="bg-blue-500 h-full transition-all"
            style={{ width: `${((statusMap['closed']?.count || 0) / totalQuotesCount) * 100}%` }}
            title={`Closed: ${statusMap['closed']?.count || 0}`}
          />
          <div
            className="bg-rose-400 h-full transition-all"
            style={{ width: `${((statusMap['rejected']?.count || 0) / totalQuotesCount) * 100}%` }}
            title={`Rejected: ${statusMap['rejected']?.count || 0}`}
          />
        </div>

        {/* Pill status summary cards */}
        <div className="grid grid-cols-5 gap-3">
          <div className="p-2.5 rounded-md border border-slate-200 bg-slate-50">
            <span className="text-[11px] font-medium text-slate-600 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>Draft</span>
            </span>
            <div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
              {statusMap['draft']?.count || 0}
            </div>
            <div className="text-[10px] text-slate-500 tabular-nums">
              ₹ {formatCurrency(statusMap['draft']?.val || 0)}
            </div>
          </div>

          <div className="p-2.5 rounded-md border border-amber-200 bg-amber-50">
            <span className="text-[11px] font-medium text-amber-800 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>In Review</span>
            </span>
            <div className="text-lg font-bold text-amber-900 mt-1 tabular-nums">
              {statusMap['in_review']?.count || 0}
            </div>
            <div className="text-[10px] text-amber-700 tabular-nums">
              ₹ {formatCurrency(statusMap['in_review']?.val || 0)}
            </div>
          </div>

          <div className="p-2.5 rounded-md border border-emerald-200 bg-emerald-50">
            <span className="text-[11px] font-medium text-emerald-800 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Approved</span>
            </span>
            <div className="text-lg font-bold text-emerald-900 mt-1 tabular-nums">
              {statusMap['approved']?.count || 0}
            </div>
            <div className="text-[10px] text-emerald-700 tabular-nums">
              ₹ {formatCurrency(statusMap['approved']?.val || 0)}
            </div>
          </div>

          <div className="p-2.5 rounded-md border border-blue-200 bg-blue-50">
            <span className="text-[11px] font-medium text-blue-800 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Closed</span>
            </span>
            <div className="text-lg font-bold text-blue-900 mt-1 tabular-nums">
              {statusMap['closed']?.count || 0}
            </div>
            <div className="text-[10px] text-blue-700 tabular-nums">
              ₹ {formatCurrency(statusMap['closed']?.val || 0)}
            </div>
          </div>

          <div className="p-2.5 rounded-md border border-rose-200 bg-rose-50">
            <span className="text-[11px] font-medium text-rose-800 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Rejected</span>
            </span>
            <div className="text-lg font-bold text-rose-900 mt-1 tabular-nums">
              {statusMap['rejected']?.count || 0}
            </div>
            <div className="text-[10px] text-rose-700 tabular-nums">
              ₹ {formatCurrency(statusMap['rejected']?.val || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Bottom Grid: Recent Activity & Sales Leaderboard */}
      <div className="grid grid-cols-3 gap-5">
        {/* Recent Quotations Table (2 Cols) */}
        <div className="col-span-2 card p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Recent Quotation Activity
                </h2>
                <p className="text-[11px] text-slate-500">
                  Latest updates from across the showroom network
                </p>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Feed</span>
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-3">Quotation Ref</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Salesperson</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Net Total</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.recentQuotations && data.recentQuotations.length > 0 ? (
                    data.recentQuotations.map((q: any) => (
                      <tr
                        key={q.id}
                        onClick={() => onSelectQuotation(q.id)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                          {q.quotation_number}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {q.customer_name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {q.sales_person_name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`badge badge-${q.status}`}>{q.status}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">
                          ₹ {formatCurrency(q.net_total)}
                        </td>
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={(e) => handleOpenPdf(q, e)}
                              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                              title="Preview PDF"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              onClick={() => onSelectQuotation(q.id)}
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="View Details"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No recent quotations recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Salesperson Performance Leaderboard (1 Col) */}
        <div className="card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Award size={16} className="text-amber-600" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Sales Leaderboard
                </h2>
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                MTD Performance
              </span>
            </div>

            <div className="space-y-2.5">
              {data?.leaderboard && data.leaderboard.length > 0 ? (
                data.leaderboard.map((item: any, idx: number) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-md border border-slate-100 bg-slate-50/70 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-700 border border-slate-300'
                            : 'bg-orange-100 text-orange-800 border border-orange-200'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{item.full_name}</p>
                        <p className="text-[10px] text-slate-500 tabular-nums">
                          {item.total_quotations} quotes created
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-900 tabular-nums">
                        ₹ {formatCurrency(item.sales_achieved)}
                      </p>
                      <p className="text-[10px] text-emerald-700 font-medium">Approved / Closed</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No salesperson performance data yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {previewPdf && (
        <PdfPreviewModal
          isOpen={true}
          onClose={() => setPreviewPdf(null)}
          pdfUrl={previewPdf.url}
          title={previewPdf.title}
          fileName={previewPdf.fileName}
          quotationId={previewPdf.quotationId}
        />
      )}
    </div>
  );
};
