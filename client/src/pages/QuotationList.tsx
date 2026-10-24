import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import { Quotation, Pagination, User } from '../types';
import {
  Search,
  Filter,
  FileText,
  Printer,
  Edit,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Users,
} from 'lucide-react';
import { PdfPreviewModal } from '../components/PdfPreviewModal';

interface Props {
  onSelectQuotation: (id: number) => void;
  onEditQuotation: (id: number) => void;
  onCreateQuotation: () => void;
}

export const QuotationList: React.FC<Props> = ({
  onSelectQuotation,
  onEditQuotation,
  onCreateQuotation,
}) => {
  const { fetchApi, getPdfUrl, subscribeToEvents } = useServer();
  const { user } = useAuth();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<{ totalQuotations: number; totalAmount: number }>({
    totalQuotations: 0,
    totalAmount: 0,
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<number | null>(null);
  const [salesTeam, setSalesTeam] = useState<User[]>([]);
  const [page, setPage] = useState(1);

  // Status Change Modal State
  const [statusModal, setStatusModal] = useState<{ id: number; currentStatus: string; targetStatus: string } | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // PDF Preview State
  const [previewPdf, setPreviewPdf] = useState<{ url: string; title: string; fileName: string } | null>(null);

  // Load sales team for filter
  useEffect(() => {
    fetchApi<any>('/api/users')
      .then((res: any) => {
        const list = res.users || res || [];
        if (Array.isArray(list)) {
          setSalesTeam(list.filter((u: User) => u.is_active));
        }
      })
      .catch((err) => console.error('Failed to load sales team:', err));
  }, []);

  // Debounce search input (300ms) to prevent excessive server requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
      });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (status) params.append('status', status);
      if (selectedSalesPersonId) params.append('sales_person_id', String(selectedSalesPersonId));

      const res = await fetchApi<any>(`/api/quotations?${params.toString()}`);
      setQuotations(res.quotations || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
      setSummary(res.summary || { totalQuotations: 0, totalAmount: 0 });
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, [page, debouncedSearch, status, selectedSalesPersonId]);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      if (['QUOTATION_CREATED', 'QUOTATION_UPDATED', 'QUOTATION_STATUS_CHANGED'].includes(event.type)) {
        loadQuotations();
      }
    });
    return () => unsubscribe();
  }, [page, debouncedSearch, status, selectedSalesPersonId]);

  const handleOpenPdf = (q: Quotation, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getPdfUrl(q.id);
    setPreviewPdf({
      url,
      title: `Quotation ${q.quotation_number} — ${q.customer_name}`,
      fileName: `Quotation_${q.quotation_number}.pdf`,
    });
  };

  const handleStatusSubmit = async () => {
    if (!statusModal) return;
    setUpdatingStatus(true);
    try {
      await fetchApi(`/api/quotations/${statusModal.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: statusModal.targetStatus,
          manager_approval_note: approvalNote,
        }),
      });
      setStatusModal(null);
      setApprovalNote('');
      loadQuotations();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  };

  const canApprove = ['admin', 'manager'].includes(user?.role || '');

  const statusChips = [
    { id: '', label: 'All Quotations' },
    { id: 'draft', label: 'Draft' },
    { id: 'in_review', label: 'In Review' },
    { id: 'approved', label: 'Approved' },
    { id: 'closed', label: 'Closed' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="flex-1 p-6 space-y-4 overflow-y-auto">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Quotations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {summary.totalQuotations} records recorded • Total Value ₹ {formatCurrency(summary.totalAmount)}
          </p>
        </div>

        <button onClick={onCreateQuotation} className="btn btn-primary btn-sm">
          <Plus size={14} />
          <span>New Quotation</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              className="input input-sm pl-8 pr-8 w-full"
              placeholder="Search by quotation number, customer name, mobile, project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Sales Associate Filter Dropdown */}
          <div className="relative min-w-[220px]">
            <Users size={13} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
            <select
              className={`select select-sm pl-8 pr-7 w-full text-xs font-medium cursor-pointer ${
                selectedSalesPersonId
                  ? 'border-indigo-500 bg-indigo-50/50 text-indigo-950 font-semibold'
                  : 'text-slate-700'
              }`}
              value={selectedSalesPersonId || ''}
              onChange={(e) => {
                setSelectedSalesPersonId(e.target.value ? Number(e.target.value) : null);
                setPage(1);
              }}
            >
              <option value="">All Sales Associates</option>
              {salesTeam.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.full_name} ({sp.role})
                </option>
              ))}
            </select>
            {selectedSalesPersonId && (
              <button
                onClick={() => {
                  setSelectedSalesPersonId(null);
                  setPage(1);
                }}
                className="absolute right-7 top-2 text-slate-400 hover:text-slate-600"
                title="Clear sales associate filter"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={loadQuotations}
            className="btn btn-secondary btn-sm shrink-0"
            title="Refresh list"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Status Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5">
          {statusChips.map((chip) => {
            const isSelected = status === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => {
                  setStatus(chip.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quotations Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold text-[11px]">
                <th className="py-2.5 px-3">Quotation Ref</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Sales Associate</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Net Total</th>
                <th className="py-2.5 px-3 text-right">Paid</th>
                <th className="py-2.5 px-3 text-right">Balance Due</th>
                <th className="py-2.5 px-3 text-center">Workflow & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && quotations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="animate-spin inline mr-2 text-slate-600" size={16} />
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No quotations match current filters.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => onSelectQuotation(q.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                      {q.quotation_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(q.quotation_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{q.customer_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{q.customer_phone}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">{q.sales_person_name}</div>
                      {q.assisted_sales_person_name && (
                        <div className="text-[10px] text-indigo-700 font-medium inline-flex items-center space-x-1 mt-0.5">
                          <span className="bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-sans">
                            🤝 +{q.assisted_sales_person_name} ({Number(q.assisted_sales_share_percent || 50).toFixed(0)}%)
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`badge badge-${q.status}`}>{q.status}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                      <div>₹ {formatCurrency(q.net_total)}</div>
                      {selectedSalesPersonId && q.assisted_sales_person_id && (
                        <div className="text-[10px] text-indigo-700 font-semibold font-mono">
                          Credit: ₹{' '}
                          {formatCurrency(
                            q.sales_person_id === selectedSalesPersonId
                              ? (q.primary_sales_share_amount || Math.round((q.net_total * (q.primary_sales_share_percent || 100)) / 100))
                              : (q.assisted_sales_share_amount || Math.round((q.net_total * (q.assisted_sales_share_percent || 0)) / 100))
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold tabular-nums">
                      ₹ {formatCurrency(q.total_paid || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-700 font-semibold tabular-nums">
                      ₹ {formatCurrency(q.balance_due || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={(e) => handleOpenPdf(q, e)}
                          title="Preview & Print PDF"
                          className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                        >
                          <Printer size={13} />
                        </button>
                        <button
                          onClick={() => onSelectQuotation(q.id)}
                          title="View Details"
                          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => onEditQuotation(q.id)}
                          title="Edit Quotation"
                          className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                        >
                          <Edit size={13} />
                        </button>

                        {/* Status Transition Quick Buttons */}
                        {q.status === 'draft' && (
                          <button
                            onClick={() =>
                              setStatusModal({
                                id: q.id,
                                currentStatus: q.status,
                                targetStatus: 'in_review',
                              })
                            }
                            className="btn btn-secondary btn-xs text-[10px] text-amber-800"
                            title="Submit for Manager Review"
                          >
                            Review
                          </button>
                        )}

                        {q.status === 'in_review' && canApprove && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() =>
                                setStatusModal({
                                  id: q.id,
                                  currentStatus: q.status,
                                  targetStatus: 'approved',
                                })
                              }
                              className="btn btn-success btn-xs text-[10px]"
                              title="Approve Quotation"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() =>
                                setStatusModal({
                                  id: q.id,
                                  currentStatus: q.status,
                                  targetStatus: 'rejected',
                                })
                              }
                              className="btn btn-danger btn-xs text-[10px]"
                              title="Reject Quotation"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary btn-sm p-1 disabled:opacity-40"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-medium tabular-nums">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="btn btn-secondary btn-sm p-1 disabled:opacity-40"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Status Transition Note Modal */}
      {statusModal && (
        <div className="modal-overlay" onClick={() => setStatusModal(null)}>
          <div
            className="card p-5 max-w-md w-full shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Change Status: {statusModal.targetStatus.replace('_', ' ')}
              </h3>
              <button
                onClick={() => setStatusModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <label className="block text-slate-700 font-semibold">
                Approval / Rejection Note (Optional)
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="Enter comments for sales associate or audit log..."
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setStatusModal(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusSubmit}
                disabled={updatingStatus}
                className="btn btn-primary btn-sm"
              >
                {updatingStatus ? 'Updating...' : 'Confirm Status Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewPdf && (
        <PdfPreviewModal
          isOpen={true}
          onClose={() => setPreviewPdf(null)}
          pdfUrl={previewPdf.url}
          title={previewPdf.title}
          fileName={previewPdf.fileName}
        />
      )}
    </div>
  );
};
