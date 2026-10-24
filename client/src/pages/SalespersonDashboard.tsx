import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import { User, Quotation, Pagination } from '../types';
import {
  Users,
  UserPlus,
  Target,
  FileText,
  CreditCard,
  TrendingUp,
  Search,
  Filter,
  Eye,
  Printer,
  Edit,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Phone,
  Mail,
  Award,
  AlertCircle,
  CheckCircle,
  Plus,
} from 'lucide-react';
import { PdfPreviewModal } from '../components/PdfPreviewModal';

interface Props {
  onSelectQuotation: (id: number) => void;
  onEditQuotation: (id: number) => void;
  onCreateQuotation: () => void;
}

export const SalespersonDashboard: React.FC<Props> = ({
  onSelectQuotation,
  onEditQuotation,
  onCreateQuotation,
}) => {
  const { fetchApi, getPdfUrl, subscribeToEvents } = useServer();
  const { user } = useAuth();

  // Salespersons list
  const [salespersons, setSalespersons] = useState<User[]>([]);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<number | null>(null);

  // Salesperson stats
  const [salespersonStats, setSalespersonStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Quotations for selected salesperson
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<{ totalQuotations: number; totalAmount: number }>({
    totalQuotations: 0,
    totalAmount: 0,
  });
  const [quotationsLoading, setQuotationsLoading] = useState(false);

  // Filters for quotations
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Add Salesperson Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTarget, setNewTarget] = useState('500000');
  const [newRole, setNewRole] = useState<'salesperson' | 'manager'>('salesperson');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);

  // PDF Preview State
  const [previewPdf, setPreviewPdf] = useState<{ url: string; title: string; fileName: string } | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load Salespersons
  const loadSalespersons = async () => {
    try {
      const res = await fetchApi('/api/users');
      const allUsers: User[] = res.users || [];
      const team = allUsers.filter((u) => ['salesperson', 'manager', 'admin'].includes(u.role) && u.is_active);
      setSalespersons(team);

      // Auto-select logged in user if salesperson, or first in list
      if (selectedSalespersonId === null) {
        if (user?.role === 'salesperson') {
          setSelectedSalespersonId(user.id);
        } else if (team.length > 0) {
          // If admin or manager, select first salesperson or keep all
          const firstSp = team.find((t) => t.role === 'salesperson') || team[0];
          setSelectedSalespersonId(firstSp.id);
        }
      }
    } catch (err) {
      console.error('Failed to load sales team:', err);
    }
  };

  useEffect(() => {
    loadSalespersons();
  }, []);

  // Load Stats for Selected Salesperson
  const loadSalespersonStats = async () => {
    if (!selectedSalespersonId) {
      setSalespersonStats(null);
      return;
    }
    setStatsLoading(true);
    try {
      const res = await fetchApi(`/api/users/${selectedSalespersonId}/stats`);
      setSalespersonStats(res);
    } catch (err) {
      console.error('Failed to load salesperson stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadSalespersonStats();
  }, [selectedSalespersonId]);

  // Load Quotations for Selected Salesperson
  const loadQuotations = async () => {
    setQuotationsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
      });
      if (selectedSalespersonId) {
        params.append('sales_person_id', String(selectedSalespersonId));
      }
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (status) params.append('status', status);

      const res = await fetchApi<any>(`/api/quotations?${params.toString()}`);
      setQuotations(res.quotations || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
      setSummary(res.summary || { totalQuotations: 0, totalAmount: 0 });
    } catch (err) {
      console.error('Failed to load salesperson quotations:', err);
    } finally {
      setQuotationsLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, [selectedSalespersonId, page, debouncedSearch, status]);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      if (
        ['QUOTATION_CREATED', 'QUOTATION_UPDATED', 'QUOTATION_STATUS_CHANGED', 'PAYMENT_RECORDED', 'USER_CREATED'].includes(
          event.type
        )
      ) {
        loadSalespersonStats();
        loadQuotations();
        if (event.type === 'USER_CREATED') {
          loadSalespersons();
        }
      }
    });
    return () => unsubscribe();
  }, [selectedSalespersonId, page, debouncedSearch, status]);

  const handleCreateSalesperson = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);

    if (!newFullName.trim() || !newUsername.trim() || !newPassword.trim()) {
      setUserError('Full Name, Username, and Password are required.');
      return;
    }

    setCreatingUser(true);
    try {
      const res = await fetchApi('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: newFullName.trim(),
          username: newUsername.trim(),
          password: newPassword.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim(),
          role: newRole,
          monthly_target: parseFloat(newTarget) || 0,
        }),
      });

      setUserSuccess(`Salesperson ${res.user.full_name} registered successfully!`);
      setTimeout(() => {
        setAddModalOpen(false);
        setUserSuccess(null);
      }, 1500);

      setNewFullName('');
      setNewUsername('');
      setNewPassword('');
      setNewPhone('');
      setNewEmail('');
      setNewTarget('500000');

      await loadSalespersons();
      setSelectedSalespersonId(res.user.id);
    } catch (err: any) {
      setUserError(err.message || 'Failed to add salesperson');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleOpenPdf = (q: Quotation, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getPdfUrl(q.id);
    setPreviewPdf({
      url,
      title: `Quotation ${q.quotation_number} — ${q.customer_name}`,
      fileName: `Quotation_${q.quotation_number}.pdf`,
    });
  };

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
  };

  const selectedUser = salespersons.find((s) => s.id === selectedSalespersonId);
  const canAddSalesperson = ['admin', 'manager'].includes(user?.role || '');

  const statusChips = [
    { id: '', label: 'All Quotations' },
    { id: 'draft', label: 'Draft' },
    { id: 'in_review', label: 'In Review' },
    { id: 'approved', label: 'Approved' },
    { id: 'closed', label: 'Closed' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto max-w-7xl">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Salesperson Performance Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual sales associate pipelines, target tracking, and quotation analytics
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {canAddSalesperson && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="btn btn-primary btn-sm"
            >
              <UserPlus size={13} />
              <span>+ Add Sales Person</span>
            </button>
          )}

          <button
            onClick={onCreateQuotation}
            className="btn btn-secondary btn-sm"
          >
            <Plus size={13} />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* Sales Team Quick Selector Bar */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Users size={13} className="text-slate-600" />
            <span>Filter by Sales Associate</span>
          </span>

          {selectedUser && (
            <div className="flex items-center space-x-3 text-xs text-slate-600">
              {selectedUser.phone && (
                <span className="flex items-center space-x-1 font-mono text-[11px]">
                  <Phone size={11} className="text-slate-400" />
                  <span>{selectedUser.phone}</span>
                </span>
              )}
              {selectedUser.email && (
                <span className="flex items-center space-x-1 text-[11px]">
                  <Mail size={11} className="text-slate-400" />
                  <span>{selectedUser.email}</span>
                </span>
              )}
              <span className="badge badge-draft font-mono">Role: {selectedUser.role}</span>
            </div>
          )}
        </div>

        {/* Team Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          {user?.role !== 'salesperson' && (
            <button
              onClick={() => {
                setSelectedSalespersonId(null);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedSalespersonId === null
                  ? 'bg-slate-900 text-white font-semibold shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Sales Team
            </button>
          )}

          {salespersons.map((sp) => {
            const isSelected = selectedSalespersonId === sp.id;
            return (
              <button
                key={sp.id}
                onClick={() => {
                  setSelectedSalespersonId(sp.id);
                  setPage(1);
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-slate-900 text-white font-semibold shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isSelected ? 'bg-white text-slate-900' : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {sp.full_name.charAt(0).toUpperCase()}
                </div>
                <span>{sp.full_name}</span>
                {sp.monthly_target && sp.monthly_target > 0 && (
                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    (₹{formatCurrency(sp.monthly_target)})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Performance Cards for Selected Salesperson */}
      <div className="grid grid-cols-4 gap-4">
        {/* Sales Target & Achievement Card */}
        <div className="card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Monthly Target vs Actual
              </span>
              <Target size={15} className="text-blue-600" />
            </div>

            <div className="flex items-baseline space-x-2 mt-2">
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                ₹ {formatCurrency(salespersonStats?.metrics?.approvedRevenue || 0)}
              </span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                / ₹ {formatCurrency(salespersonStats?.metrics?.target || selectedUser?.monthly_target || 0)}
              </span>
            </div>

            {/* Achievement progress bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2.5 border border-slate-200">
              <div
                className="bg-blue-600 h-full transition-all"
                style={{
                  width: `${Math.min(100, salespersonStats?.metrics?.targetPercent || 0)}%`,
                }}
              />
            </div>

            {/* Pipeline subline */}
            {Boolean(salespersonStats?.metrics?.pipelineRevenue) && (
              <div className="mt-2 text-[10px] text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/80 flex items-center justify-between">
                <span>Active Pipeline:</span>
                <span className="font-bold font-mono">
                  ₹ {formatCurrency(salespersonStats?.metrics?.pipelineRevenue || 0)}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-[11px] mt-2.5 pt-2 border-t border-slate-100">
            <span className="text-slate-500">Target Progress</span>
            <span className="font-bold text-blue-700 tabular-nums font-mono">
              {salespersonStats?.metrics?.targetPercent || 0}% Achieved
            </span>
          </div>
        </div>

        {/* Total Quotes Issued */}
        <div className="card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Quotations Issued
              </span>
              <FileText size={15} className="text-slate-700" />
            </div>

            <div className="text-xl font-bold text-slate-900 tabular-nums mt-2">
              {salespersonStats?.metrics?.totalQuotes || summary.totalQuotations} Quotes
            </div>
            <div className="text-xs text-slate-500 mt-1 tabular-nums">
              Total Quoted Value: ₹ {formatCurrency(salespersonStats?.metrics?.totalQuoted || summary.totalAmount)}
            </div>
          </div>

          <div className="flex space-x-2 text-[10px] mt-3 pt-2 border-t border-slate-100">
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
              {salespersonStats?.metrics?.statusMap?.['approved']?.count || 0} Approved
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200">
              {salespersonStats?.metrics?.statusMap?.['in_review']?.count || 0} Review
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
              {salespersonStats?.metrics?.statusMap?.['draft']?.count || 0} Draft
            </span>
          </div>
        </div>

        {/* Collections on Orders */}
        <div className="card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Collections Realized
              </span>
              <CreditCard size={15} className="text-emerald-600" />
            </div>

            <div className="text-xl font-bold text-emerald-700 tabular-nums mt-2">
              ₹ {formatCurrency(salespersonStats?.metrics?.totalCollected || 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Advance & settlement payments cleared
            </div>
          </div>

          <div className="text-[11px] text-emerald-700 font-medium mt-3 pt-2 border-t border-slate-100 flex items-center space-x-1">
            <CheckCircle size={12} />
            <span>Cleared through Bank/UPI/Cheque</span>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="card p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Pending Balance Due
              </span>
              <TrendingUp size={15} className="text-amber-600" />
            </div>

            <div className="text-xl font-bold text-amber-800 tabular-nums mt-2">
              ₹ {formatCurrency(salespersonStats?.metrics?.outstanding || 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              To be collected before dispatch
            </div>
          </div>

          <div className="text-[11px] text-amber-700 font-medium mt-3 pt-2 border-t border-slate-100">
            On Approved & Active Quotes
          </div>
        </div>
      </div>

      {/* Filter and Search Bar for Salesperson's Quotes */}
      <div className="card p-3 space-y-2.5">
        <div className="flex items-center space-x-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              className="input input-sm pl-8 pr-8"
              placeholder={`Search ${selectedUser ? selectedUser.full_name + "'s" : "all"} quotations by reference, customer name, mobile...`}
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

          <button
            onClick={() => {
              loadSalespersonStats();
              loadQuotations();
            }}
            className="btn btn-secondary btn-sm"
            title="Refresh list"
          >
            <RefreshCw size={12} className={quotationsLoading ? 'animate-spin' : ''} />
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

      {/* Filtered Quotations Table */}
      <div className="card overflow-hidden">
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            {selectedUser ? `${selectedUser.full_name}'s Quotations` : 'All Salesperson Quotations'} (
            {pagination.total} records)
          </span>
          <span className="text-xs text-slate-500 tabular-nums">
            Total Quoted: ₹ {formatCurrency(summary.totalAmount)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold text-[11px]">
                <th className="py-2.5 px-3">Quotation Ref</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Customer Profile</th>
                <th className="py-2.5 px-3">Project</th>
                <th className="py-2.5 px-3">Sales Associate</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Net Total</th>
                <th className="py-2.5 px-3 text-right">Collected</th>
                <th className="py-2.5 px-3 text-right">Balance Due</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotationsLoading && quotations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="animate-spin inline mr-2 text-slate-600" size={16} />
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No quotations found for this salesperson under selected filters.
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
                    <td className="py-2.5 px-3 text-slate-600">{q.project_name || 'Standard'}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">{q.sales_person_name}</div>
                      {q.assisted_sales_person_id ? (
                        q.assisted_sales_person_id === selectedSalespersonId ? (
                          <div className="text-[10px] text-indigo-700 font-medium inline-flex items-center space-x-1 mt-0.5">
                            <span className="bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-sans">
                              🤝 Co-Closer ({Number(q.assisted_sales_share_percent || 50).toFixed(0)}%)
                            </span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-blue-700 font-medium inline-flex items-center space-x-1 mt-0.5">
                            <span className="bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-sans">
                              ⭐ Lead Closer ({Number(q.primary_sales_share_percent || 50).toFixed(0)}% w/ {q.assisted_sales_person_name})
                            </span>
                          </div>
                        )
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`badge badge-${q.status}`}>{q.status}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      <div className="font-bold text-slate-900">₹ {formatCurrency(q.net_total)}</div>
                      {q.assisted_sales_person_id && (
                        <div className="text-[10px] text-indigo-700 font-semibold font-mono">
                          Credited: ₹ {formatCurrency(
                            q.assisted_sales_person_id === selectedSalespersonId
                              ? (q.assisted_sales_share_amount || 0)
                              : (q.primary_sales_share_amount || q.net_total)
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

      {/* Add Salesperson Modal */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div
            className="card shadow-xl w-full max-w-lg p-5 border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <div className="flex items-center space-x-2">
                <UserPlus size={17} className="text-slate-900" />
                <h2 className="text-sm font-bold text-slate-900 uppercase">
                  Add New Sales Associate
                </h2>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={17} />
              </button>
            </div>

            {userError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs flex items-center space-x-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{userError}</span>
              </div>
            )}

            {userSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-xs flex items-center space-x-2">
                <CheckCircle size={15} className="shrink-0" />
                <span>{userSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateSalesperson} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    System Username *
                  </label>
                  <input
                    type="text"
                    className="input input-sm font-mono"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. ramesh"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Initial Login Password *
                  </label>
                  <input
                    type="password"
                    className="input input-sm font-mono"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Role Category
                  </label>
                  <select
                    className="input input-sm"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                  >
                    <option value="salesperson">Salesperson / Showroom Associate</option>
                    <option value="manager">Store Manager</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    className="input input-sm font-mono"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. +91 98251 45678"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="input input-sm"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. ramesh@amaceramics.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Monthly Sales Target (INR)
                </label>
                <input
                  type="number"
                  step="10000"
                  className="input input-sm tabular-nums font-semibold"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="e.g. 500000"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Target for performance tracking and salesperson dashboard analytics
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAddModalOpen(false)}
                  disabled={creatingUser}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={creatingUser}
                >
                  {creatingUser ? 'Registering...' : 'Register Sales Associate'}
                </button>
              </div>
            </form>
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
