import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import {
  History,
  X,
  Printer,
  RefreshCw,
  RotateCcw,
  CheckCircle,
  Clock,
  ShieldAlert,
  ArrowRight,
  Eye,
  FileText,
  Building,
  User,
  ChevronRight,
  Sparkles,
  Maximize2,
  SplitSquareVertical,
  Columns,
  Layers,
  ArrowLeftRight,
  Plus,
} from 'lucide-react';
import { PdfPreviewModal } from './PdfPreviewModal';

interface VersionSummary {
  id: number;
  quotation_id: number;
  version_number: number;
  is_current: boolean;
  edited_by_id: number | null;
  edited_by_name: string;
  revision_summary: string;
  gross_total: number;
  discount_percent: number;
  discount_amount: number;
  taxable_amount: number;
  net_total: number;
  status: string;
  created_at: string;
  items_count: number;
}

interface Props {
  quotationId: number;
  quotationNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onRestored?: () => void;
  initialVersion?: number;
}

export const QuotationHistoryModal: React.FC<Props> = ({
  quotationId,
  quotationNumber,
  isOpen,
  onClose,
  onRestored,
  initialVersion,
}) => {
  const { fetchApi, getVersionPdfUrl } = useServer();
  const { user } = useAuth();

  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [cachedSnapshots, setCachedSnapshots] = useState<Record<number, any>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<number | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'review' | 'compare'>('review');

  // Comparison version selections
  const [compareVersionA, setCompareVersionA] = useState<number | null>(null);
  const [compareVersionB, setCompareVersionB] = useState<number | null>(null);

  // PDF Preview
  const [previewPdf, setPreviewPdf] = useState<{
    url: string;
    title: string;
    fileName: string;
  } | null>(null);

  const loadVersions = async (targetVer?: number) => {
    try {
      setLoading(true);
      const res = await fetchApi<{ versions: VersionSummary[]; current_version: number }>(
        `/api/quotations/${quotationId}/versions`
      );
      const list = res.versions || [];
      setVersions(list);

      if (list.length > 0) {
        // If target or initialVersion provided, choose that, otherwise default to initialVersion prop or latest
        const preferred = targetVer || initialVersion;
        const initial = preferred && list.some((v) => v.version_number === preferred)
          ? preferred
          : list[0].version_number;

        setSelectedVersionNum(initial);
        await loadVersionDetail(initial);

        // If there are at least 2 versions, setup comparison defaults (v1 vs latest)
        if (list.length >= 2) {
          const vOld = list[list.length - 1].version_number;
          const vNew = list[0].version_number;
          setCompareVersionA(vOld);
          setCompareVersionB(vNew);
          // Pre-fetch the older version too so compare tab is instant
          loadVersionDetail(vOld);
          loadVersionDetail(vNew);
        }
      }
    } catch (err: any) {
      console.error('Failed to load quotation versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVersionDetail = async (vNum: number) => {
    if (cachedSnapshots[vNum]) {
      return cachedSnapshots[vNum];
    }
    try {
      setLoadingDetail(true);
      const res = await fetchApi<any>(`/api/quotations/${quotationId}/versions/${vNum}`);
      setCachedSnapshots((prev) => ({ ...prev, [vNum]: res }));
      return res;
    } catch (err: any) {
      console.error('Failed to load version details:', err);
      return null;
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (isOpen && quotationId) {
      loadVersions(initialVersion);
    } else {
      setSelectedVersionNum(null);
      setRestoreConfirm(null);
      setEnlargedImage(null);
      setViewMode('review');
    }
  }, [isOpen, quotationId, initialVersion]);

  const handleSelectVersion = (vNum: number) => {
    setSelectedVersionNum(vNum);
    setViewMode('review');
    loadVersionDetail(vNum);
  };

  const handleRestore = async (vNum: number) => {
    try {
      setRestoring(true);
      await fetchApi(`/api/quotations/${quotationId}/versions/${vNum}/restore`, {
        method: 'POST',
      });
      setRestoreConfirm(null);
      await loadVersions();
      if (onRestored) {
        onRestored();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to restore quotation version');
    } finally {
      setRestoring(false);
    }
  };

  const handleOpenPdf = (encrypted: boolean = false, targetVer?: number) => {
    const vNum = targetVer || selectedVersionNum;
    if (!vNum) return;
    const url = getVersionPdfUrl(quotationId, vNum, encrypted);
    setPreviewPdf({
      url,
      title: `Quotation ${quotationNumber} (v${vNum})${encrypted ? ' [Encrypted]' : ''}`,
      fileName: `Quotation_${quotationNumber}_v${vNum}${encrypted ? '_Encrypted' : ''}.pdf`,
    });
  };

  const formatCurrency = (val: any) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  };

  const derive3LetterCode = (name: string): string => {
    if (!name) return 'AMA';
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      return (words[0][0] + words[1][0] + words[2][0]).toUpperCase() + ' - AMA';
    } else if (words.length === 2) {
      const part1 = words[0].slice(0, 2);
      const part2 = words[1].slice(0, 1);
      return (part1 + part2).toUpperCase() + ' - AMA';
    } else {
      const clean = words[0].replace(/[^a-zA-Z0-9]/g, '');
      return clean.slice(0, 3).padEnd(3, 'X').toUpperCase() + ' - AMA';
    }
  };

  if (!isOpen) return null;

  const selectedVersionDetail = selectedVersionNum ? cachedSnapshots[selectedVersionNum] : null;
  const currentSnapshot = selectedVersionDetail?.snapshot;
  const currentQuotation = currentSnapshot?.quotation;
  const currentAreas = currentSnapshot?.areas || [];
  const isSanitary = (currentQuotation?.quotation_type || '').toLowerCase() === 'sanitary';

  // Extract all items flattened for sanitary ware
  const allSanitaryItems: any[] = [];
  if (isSanitary) {
    currentAreas.forEach((a: any) => {
      (a.items || []).forEach((it: any) => allSanitaryItems.push(it));
    });
  }

  // Parse monetary numbers safely for selected version
  const grossTotal = parseFloat(currentQuotation?.gross_total || '0') || 0;
  const discountAmount = parseFloat(currentQuotation?.discount_amount || '0') || 0;
  const discountPercent = parseFloat(currentQuotation?.discount_percent || '0') || 0;
  const taxableAmount = parseFloat(currentQuotation?.taxable_amount || '0') || 0;
  const netTotal = parseFloat(currentQuotation?.net_total || '0') || 0;
  const roundOff = parseFloat(currentQuotation?.round_off || '0') || 0;
  const cgstRate = parseFloat(currentQuotation?.cgst_rate || '9') || 9;
  const cgstAmount = parseFloat(currentQuotation?.cgst_amount || '0') || 0;
  const sgstRate = parseFloat(currentQuotation?.sgst_rate || '9') || 9;
  const sgstAmount = parseFloat(currentQuotation?.sgst_amount || '0') || 0;
  const igstRate = parseFloat(currentQuotation?.igst_rate || '18') || 18;
  const igstAmount = parseFloat(currentQuotation?.igst_amount || '0') || 0;

  // Comparison details
  const compDetailA = compareVersionA ? cachedSnapshots[compareVersionA] : null;
  const compDetailB = compareVersionB ? cachedSnapshots[compareVersionB] : null;
  const compQuoteA = compDetailA?.snapshot?.quotation;
  const compQuoteB = compDetailB?.snapshot?.quotation;
  const compAreasA = compDetailA?.snapshot?.areas || [];
  const compAreasB = compDetailB?.snapshot?.areas || [];

  const previousVersionNum = versions.length > 1 ? versions[versions.length - 1].version_number : null;
  const isViewingPrevious = selectedVersionNum && previousVersionNum && selectedVersionNum === previousVersionNum;
  const activeVersionNum = versions.length > 0 ? versions[0].version_number : null;

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 100,
        backgroundColor: 'rgba(13, 27, 42, 0.70)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col"
        style={{
          width: '96vw',
          maxWidth: '1280px',
          height: '92vh',
          backgroundColor: '#FFFFFF',
          color: '#0D1B2A',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div
          className="px-5 py-3 text-white flex items-center justify-between shrink-0 border-b border-slate-800"
          style={{ backgroundColor: '#0D1B2A' }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <History size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold tracking-tight text-white">Quotation Edit & Version History</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                  {quotationNumber}
                </span>
                <span className="text-[11px] text-slate-300">({versions.length} revisions)</span>
                {isSanitary ? (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700">
                    🚿 Sanitary Ware
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700">
                    🧱 Tiles
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Review previous quotes, inspect line-items & values, compare revisions, or export historical snapshots
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('review')}
                className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  viewMode === 'review'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Eye size={13} />
                <span>Review Quotation</span>
              </button>

              {versions.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('compare');
                    if (compareVersionA) loadVersionDetail(compareVersionA);
                    if (compareVersionB) loadVersionDetail(compareVersionB);
                  }}
                  className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    viewMode === 'compare'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ArrowLeftRight size={13} />
                  <span>Compare Side-by-Side</span>
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body Container: Strict Flex-Row with Non-Collapsing Columns */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            backgroundColor: '#F8FAFC',
          }}
        >
          {/* Left Column: Revision Timeline */}
          <div
            style={{
              width: '300px',
              flexShrink: 0,
              borderRight: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            {/* Header / Quick Switch */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1">
                <Layers size={13} className="text-slate-500" />
                <span>Revisions ({versions.length})</span>
              </span>
              <button
                onClick={() => loadVersions()}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer font-medium"
                title="Refresh version timeline"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Quick Switch to Previous Quotation Button */}
            {versions.length > 1 && (
              <div className="p-2.5 bg-amber-50/80 border-b border-amber-200 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const prev = versions[versions.length - 1].version_number;
                    handleSelectVersion(prev);
                  }}
                  className={`w-full text-xs font-bold py-1.5 px-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                    isViewingPrevious
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100/70'
                  }`}
                >
                  <span className="flex items-center space-x-1.5">
                    <span>📜</span>
                    <span>Review Previous Quote (v{previousVersionNum})</span>
                  </span>
                  <span className="font-mono text-[11px] font-semibold">
                    ₹{formatCurrency(versions[versions.length - 1].net_total)}
                  </span>
                </button>
              </div>
            )}

            {/* Revision List */}
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading version history...</div>
            ) : versions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No revisions found.</div>
            ) : (
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
                {versions.map((v) => {
                  const isSelected = selectedVersionNum === v.version_number && viewMode === 'review';
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectVersion(v.version_number)}
                      style={{ textAlign: 'left', width: '100%' }}
                      className={`p-3.5 transition-all flex flex-col space-y-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 border-l-4 border-indigo-600 shadow-2xs'
                          : 'hover:bg-slate-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                              v.is_current
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}
                          >
                            v{v.version_number}
                          </span>
                          {v.is_current ? (
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                              (Active)
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-500">
                              (Historical)
                            </span>
                          )}
                        </div>
                        <span className={`badge badge-${v.status} text-[10px]`}>
                          {v.status ? v.status.replace('_', ' ') : ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="font-bold text-slate-900 font-mono text-sm">
                          ₹ {formatCurrency(v.net_total)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {v.items_count} {v.items_count === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 line-clamp-1 italic">
                        {v.revision_summary || 'Quotation revision'}
                      </p>

                      <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 mt-1">
                        <span className="font-medium text-slate-700 truncate max-w-[140px]">
                          👤 {v.edited_by_name || 'System'}
                        </span>
                        <span>
                          {new Date(v.created_at).toLocaleString('en-GB', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Dynamic Content (Review vs Compare) */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              backgroundColor: '#FFFFFF',
              padding: '16px 20px',
            }}
          >
            {/* VIEW MODE: COMPARE SIDE-BY-SIDE */}
            {viewMode === 'compare' && versions.length >= 2 ? (
              <div className="space-y-4">
                {/* Comparison Header Card */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <ArrowLeftRight size={16} className="text-indigo-400" />
                        <h3 className="text-sm font-bold text-white tracking-wide">
                          Side-by-Side Quotation Revision Comparison
                        </h3>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Inspect items and values between Previous and Current quotation revisions
                      </p>
                    </div>

                    {/* Version Selector Dropdowns */}
                    <div className="flex items-center space-x-2 text-xs">
                      <div className="flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                        <span className="text-slate-400">Base:</span>
                        <select
                          className="bg-transparent text-white font-bold outline-none cursor-pointer"
                          value={compareVersionA || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setCompareVersionA(val);
                            loadVersionDetail(val);
                          }}
                        >
                          {versions.map((v) => (
                            <option key={v.id} value={v.version_number} className="bg-slate-900 text-white">
                              v{v.version_number} (₹{formatCurrency(v.net_total)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className="text-slate-400 font-bold">vs</span>

                      <div className="flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                        <span className="text-slate-400">Compare:</span>
                        <select
                          className="bg-transparent text-white font-bold outline-none cursor-pointer"
                          value={compareVersionB || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setCompareVersionB(val);
                            loadVersionDetail(val);
                          }}
                        >
                          {versions.map((v) => (
                            <option key={v.id} value={v.version_number} className="bg-slate-900 text-white">
                              v{v.version_number} (₹{formatCurrency(v.net_total)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* High Level Diff Metric */}
                  {compQuoteA && compQuoteB && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-800/80 text-xs">
                      <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700">
                        <span className="text-slate-400 text-[11px] block">Base (v{compareVersionA}) Value</span>
                        <span className="font-mono text-base font-bold text-amber-300">
                          ₹ {formatCurrency(compQuoteA.net_total)}
                        </span>
                      </div>

                      <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700">
                        <span className="text-slate-400 text-[11px] block">Compare (v{compareVersionB}) Value</span>
                        <span className="font-mono text-base font-bold text-emerald-300">
                          ₹ {formatCurrency(compQuoteB.net_total)}
                        </span>
                      </div>

                      <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700">
                        <span className="text-slate-400 text-[11px] block">Net Value Difference</span>
                        {(() => {
                          const diff = parseFloat(compQuoteB.net_total || 0) - parseFloat(compQuoteA.net_total || 0);
                          const pct = parseFloat(compQuoteA.net_total || 0) > 0 ? (diff / parseFloat(compQuoteA.net_total)) * 100 : 0;
                          return (
                            <span
                              className={`font-mono text-base font-bold ${
                                diff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {diff >= 0 ? '+' : ''}₹ {formatCurrency(diff)}{' '}
                              <span className="text-xs font-normal">({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Side-by-Side Dual Panels */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left Column: Version A */}
                  <div className="card p-3.5 border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div>
                        <span className="font-bold text-sm text-slate-900">
                          Previous Quotation (v{compareVersionA})
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Saved by {compDetailA?.edited_by_name || 'Associate'} on{' '}
                          {compDetailA?.created_at ? new Date(compDetailA.created_at).toLocaleString('en-GB') : '-'}
                        </p>
                      </div>
                      <span className="font-mono text-base font-bold text-indigo-950">
                        ₹ {formatCurrency(compQuoteA?.net_total || 0)}
                      </span>
                    </div>

                    {/* Items Table for Version A */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border border-slate-200 rounded">
                        <thead className="bg-slate-50 text-[11px] text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-1.5 px-2">#</th>
                            <th className="py-1.5 px-2">Description</th>
                            <th className="py-1.5 px-2">Size</th>
                            <th className="py-1.5 px-2 text-right">Qty</th>
                            <th className="py-1.5 px-2 text-right">Rate (₹)</th>
                            <th className="py-1.5 px-2 text-right font-bold">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {compAreasA.flatMap((a: any) => a.items || []).map((it: any, idx: number) => (
                            <tr key={it.id || idx} className="hover:bg-slate-50">
                              <td className="py-1.5 px-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                              <td className="py-1.5 px-2 font-medium text-slate-900">
                                <div>{it.description}</div>
                                {it.brand && <div className="text-[10px] text-slate-400">{it.brand}</div>}
                              </td>
                              <td className="py-1.5 px-2 font-mono text-[11px] text-slate-600">{it.size || '-'}</td>
                              <td className="py-1.5 px-2 text-right font-mono">
                                {it.quantity_sqft || it.quantity_boxes || it.quantity || 1}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono">
                                ₹{formatCurrency(it.rate_per_sqft || it.rate_per_box || 0)}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                                ₹{formatCurrency(it.total_amount || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Version B */}
                  <div className="card p-3.5 border border-indigo-200 bg-white space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                      <div>
                        <span className="font-bold text-sm text-indigo-950">
                          Revised Quotation (v{compareVersionB})
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Saved by {compDetailB?.edited_by_name || 'Associate'} on{' '}
                          {compDetailB?.created_at ? new Date(compDetailB.created_at).toLocaleString('en-GB') : '-'}
                        </p>
                      </div>
                      <span className="font-mono text-base font-bold text-emerald-800">
                        ₹ {formatCurrency(compQuoteB?.net_total || 0)}
                      </span>
                    </div>

                    {/* Items Table for Version B */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border border-indigo-100 rounded">
                        <thead className="bg-indigo-50/60 text-[11px] text-slate-700 border-b border-indigo-100">
                          <tr>
                            <th className="py-1.5 px-2">#</th>
                            <th className="py-1.5 px-2">Description</th>
                            <th className="py-1.5 px-2">Size</th>
                            <th className="py-1.5 px-2 text-right">Qty</th>
                            <th className="py-1.5 px-2 text-right">Rate (₹)</th>
                            <th className="py-1.5 px-2 text-right font-bold">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {compAreasB.flatMap((a: any) => a.items || []).map((it: any, idx: number) => (
                            <tr key={it.id || idx} className="hover:bg-indigo-50/40">
                              <td className="py-1.5 px-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                              <td className="py-1.5 px-2 font-medium text-slate-900">
                                <div>{it.description}</div>
                                {it.brand && <div className="text-[10px] text-slate-400">{it.brand}</div>}
                              </td>
                              <td className="py-1.5 px-2 font-mono text-[11px] text-slate-600">{it.size || '-'}</td>
                              <td className="py-1.5 px-2 text-right font-mono">
                                {it.quantity_sqft || it.quantity_boxes || it.quantity || 1}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono">
                                ₹{formatCurrency(it.rate_per_sqft || it.rate_per_box || 0)}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                                ₹{formatCurrency(it.total_amount || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* VIEW MODE: DETAILED REVIEW FOR SELECTED VERSION */}
            {viewMode === 'review' && (
              <>
                {loadingDetail ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-2">
                    <RefreshCw size={28} className="animate-spin text-indigo-600" />
                    <span className="text-xs text-slate-500 font-medium">Loading line items & commercial details...</span>
                  </div>
                ) : !selectedVersionDetail || !currentQuotation ? (
                  <div className="flex-1 flex items-center justify-center py-20 text-xs text-slate-400">
                    Select a version from the timeline on the left to review its items and commercial values.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Prominent Version Inspection Banner */}
                    <div
                      className={`rounded-xl border p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 ${
                        isViewingPrevious
                          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                          : selectedVersionNum === activeVersionNum
                          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-base font-bold font-mono text-slate-900">
                            {isViewingPrevious ? '📜 Reviewing Previous Quotation' : 'Reviewing Quotation'}{' '}
                            (Version {selectedVersionDetail.version_number})
                          </span>

                          {selectedVersionNum === activeVersionNum ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Active Current Version
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Historical Snapshot
                            </span>
                          )}

                          <span className={`badge badge-${currentQuotation.status}`}>
                            {currentQuotation.status ? currentQuotation.status.replace('_', ' ') : ''}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-0.5">
                          Saved on{' '}
                          <strong>{new Date(selectedVersionDetail.created_at).toLocaleString('en-GB')}</strong> by{' '}
                          <span className="font-semibold text-slate-800">
                            {selectedVersionDetail.edited_by_name}
                          </span>
                          {selectedVersionDetail.revision_summary && (
                            <span className="ml-2 text-slate-600 italic">
                              — "{selectedVersionDetail.revision_summary}"
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center space-x-2">
                        {/* Quick switch between previous and current */}
                        {isViewingPrevious && activeVersionNum && (
                          <button
                            type="button"
                            onClick={() => handleSelectVersion(activeVersionNum)}
                            className="btn btn-secondary btn-sm bg-white font-semibold flex items-center space-x-1 cursor-pointer"
                            title="Switch to Active Current Version"
                          >
                            <span>View Current (v{activeVersionNum})</span>
                            <ArrowRight size={13} />
                          </button>
                        )}

                        {!isViewingPrevious && previousVersionNum && (
                          <button
                            type="button"
                            onClick={() => handleSelectVersion(previousVersionNum)}
                            className="btn btn-secondary btn-sm bg-amber-100/70 border-amber-300 text-amber-900 font-semibold flex items-center space-x-1 cursor-pointer"
                            title="Switch to Previous Historical Version"
                          >
                            <span>View Previous (v{previousVersionNum})</span>
                          </button>
                        )}

                        {/* View Historical PDF */}
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(false)}
                          className="btn btn-secondary btn-sm flex items-center space-x-1 cursor-pointer bg-white"
                          title="Download or preview PDF for this historical version"
                        >
                          <Printer size={13} className="text-slate-600" />
                          <span>Print / PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenPdf(true)}
                          className="btn btn-secondary btn-sm flex items-center space-x-1 text-amber-900 bg-amber-50 border-amber-300 cursor-pointer"
                          title="Download encrypted PDF for this historical version"
                        >
                          <ShieldAlert size={13} className="text-amber-600" />
                          <span>Encrypted PDF</span>
                        </button>

                        {/* Restore Version Button */}
                        {selectedVersionNum !== activeVersionNum && (
                          <>
                            {restoreConfirm === selectedVersionNum ? (
                              <div className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 p-1 rounded-md">
                                <span className="text-[11px] font-bold text-rose-700 px-1">
                                  Restore this quote?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => selectedVersionNum && handleRestore(selectedVersionNum)}
                                  disabled={restoring}
                                  className="btn btn-xs bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                                >
                                  {restoring ? 'Restoring...' : 'Yes, Restore'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRestoreConfirm(null)}
                                  className="btn btn-xs btn-secondary cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setRestoreConfirm(selectedVersionNum)}
                                className="btn btn-primary btn-sm flex items-center space-x-1 shadow-xs cursor-pointer"
                                title="Revert the active quotation back to this exact version snapshot"
                              >
                                <RotateCcw size={13} />
                                <span>Restore to This Version</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Customer & Quotation Meta Header */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="card p-3 space-y-1 text-xs border border-slate-200 bg-white">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Customer Profile
                        </span>
                        <p className="font-bold text-slate-900">{currentQuotation.customer_name || 'N/A'}</p>
                        <p className="text-slate-600 font-mono">{currentQuotation.customer_phone || '-'}</p>
                        {currentQuotation.customer_gstin && (
                          <p className="text-[11px] text-slate-500 font-mono">
                            GSTIN: {currentQuotation.customer_gstin}
                          </p>
                        )}
                        {currentQuotation.delivery_address && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">
                            📍 {currentQuotation.delivery_address}
                          </p>
                        )}
                      </div>

                      <div className="card p-3 space-y-1 text-xs border border-slate-200 bg-white">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Sales Associates
                        </span>
                        <p className="font-semibold text-slate-900">
                          Primary:{' '}
                          <span className="font-bold">{currentQuotation.sales_person_name || 'Associate'}</span>
                        </p>
                        {currentQuotation.assisted_sales_person_name && (
                          <p className="text-indigo-800 text-[11px] font-medium">
                            Assisted: {currentQuotation.assisted_sales_person_name} (
                            {Number(currentQuotation.assisted_sales_share_percent || 50).toFixed(0)}%)
                          </p>
                        )}
                        <p className="text-slate-500 text-[11px]">
                          Quote Date:{' '}
                          {currentQuotation.quotation_date
                            ? new Date(currentQuotation.quotation_date).toLocaleDateString('en-GB')
                            : '-'}
                        </p>
                        {currentQuotation.project_name && (
                          <p className="text-slate-500 text-[11px]">Project: {currentQuotation.project_name}</p>
                        )}
                      </div>

                      <div className="card p-3 space-y-1 text-xs bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Approval & Store Status
                        </span>
                        <div className="flex items-center space-x-1.5">
                          <span className={`badge badge-${currentQuotation.status}`}>
                            {currentQuotation.status ? currentQuotation.status.replace('_', ' ') : ''}
                          </span>
                        </div>
                        {currentQuotation.approved_by_name ? (
                          <p className="text-emerald-800 text-[11px] font-bold flex items-center space-x-1">
                            <CheckCircle size={12} className="text-emerald-600 shrink-0" />
                            <span>Approved by Store Manager: {currentQuotation.approved_by_name}</span>
                          </p>
                        ) : currentQuotation.status === 'approved' ? (
                          <p className="text-emerald-800 text-[11px] font-bold flex items-center space-x-1">
                            <CheckCircle size={12} className="text-emerald-600 shrink-0" />
                            <span>Approved by Store Manager</span>
                          </p>
                        ) : (
                          <p className="text-amber-700 text-[11px] flex items-center space-x-1">
                            <Clock size={12} className="text-amber-600 shrink-0" />
                            <span>Pending Store Manager Approval</span>
                          </p>
                        )}
                        {currentQuotation.manager_approval_note && (
                          <p className="text-[11px] text-slate-500 italic">
                            "{currentQuotation.manager_approval_note}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Line Items Table: Dedicated Layout for Sanitary Ware vs Tiles */}
                    {isSanitary ? (
                      /* Dedicated Sanitary Ware Itemized Layout */
                      <div className="card overflow-hidden border border-slate-200 bg-white">
                        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            <span>Sanitary Ware Line Items (Version {selectedVersionDetail.version_number})</span>
                          </div>
                          <span className="text-slate-600 font-medium">
                            Total: {allSanitaryItems.length} items (
                            {allSanitaryItems.reduce(
                              (acc, it) => acc + (parseFloat(it.quantity_boxes || it.quantity) || 1),
                              0
                            )}{' '}
                            Nos)
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/80 text-[11px]">
                                <th className="py-2.5 px-3 text-center w-10">#</th>
                                <th className="py-2.5 px-3 w-14 text-center">Image</th>
                                <th className="py-2.5 px-3 w-32">Item Code</th>
                                <th className="py-2.5 px-3 min-w-[200px]">Item Description</th>
                                <th className="py-2.5 px-3 text-right w-24">Qty (Nos)</th>
                                <th className="py-2.5 px-3 text-right w-28">MRP (₹)</th>
                                <th className="py-2.5 px-3 text-right w-20">Discount %</th>
                                <th className="py-2.5 px-3 text-right w-28">Discounted Price</th>
                                <th className="py-2.5 px-3 text-right w-32 font-bold">Total (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-sans">
                              {allSanitaryItems.length > 0 ? (
                                allSanitaryItems.map((item: any, idx: number) => {
                                  const mrp = parseFloat(
                                    item.mrp_price || item.base_rate_per_box || item.rate_per_box || 0
                                  );
                                  const ratePerUnit = parseFloat(
                                    item.rate_per_box || item.base_rate_per_box || item.rate_per_sqft || 0
                                  );
                                  const discPct = parseFloat(item.discount_percent || 0);
                                  const totalAmt = parseFloat(item.total_amount || 0);
                                  const qtyNos = parseFloat(item.quantity_boxes || item.quantity || 1);

                                  return (
                                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                        {item.sl_no || idx + 1}
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        {item.item_image ? (
                                          <img
                                            src={item.item_image}
                                            alt={item.item_code}
                                            onClick={() => setEnlargedImage(item.item_image)}
                                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-2xs mx-auto cursor-pointer hover:opacity-90"
                                            title="Click to view full image"
                                          />
                                        ) : (
                                          <span className="text-slate-400 text-xs">-</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                        {item.item_code || item.size || '-'}
                                      </td>
                                      <td className="py-2.5 px-3 font-medium text-slate-800">
                                        {item.description}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                        {qtyNos} Nos
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-600 font-mono tabular-nums">
                                        ₹ {formatCurrency(mrp)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-amber-800 font-semibold tabular-nums">
                                        {discPct > 0 ? `${discPct}%` : '-'}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                                        ₹ {formatCurrency(ratePerUnit)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-950 tabular-nums text-sm">
                                        ₹ {formatCurrency(totalAmt)}
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={9} className="py-6 text-center text-slate-400">
                                    No sanitary items recorded in this revision.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      /* Dedicated Tiles Room-Wise Items Layout */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                            <FileText size={14} className="text-indigo-600" />
                            <span>
                              Line Items & Tile Specifications (Version {selectedVersionDetail.version_number})
                            </span>
                          </h3>
                          <span className="text-xs text-slate-500 font-medium">
                            {currentAreas.length} {currentAreas.length === 1 ? 'Area' : 'Areas'}
                          </span>
                        </div>

                        {currentAreas.map((area: any, aIdx: number) => (
                          <div key={area.id || aIdx} className="card overflow-hidden border border-slate-200 bg-white">
                            <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800 uppercase tracking-wide">
                              <span>AREA: {area.area_name || `Area ${aIdx + 1}`}</span>
                              <span className="text-slate-500 font-normal lowercase">
                                {(area.items || []).length} items
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/80 text-[11px]">
                                    <th className="py-2.5 px-3 text-center w-8">#</th>
                                    <th className="py-2.5 px-3 min-w-[220px]">Description</th>
                                    <th className="py-2.5 px-3">Brand</th>
                                    <th className="py-2.5 px-3">Size</th>
                                    <th className="py-2.5 px-2.5">Type</th>
                                    <th className="py-2.5 px-3 text-right">Cov/Box</th>
                                    <th className="py-2.5 px-3 text-right">Sqft</th>
                                    <th className="py-2.5 px-3 text-right">Rate/Sqft</th>
                                    <th className="py-2.5 px-3 text-right">Boxes/Qty</th>
                                    <th className="py-2.5 px-3 text-right">Rate/Unit</th>
                                    <th className="py-2.5 px-3 text-right font-bold">Total (₹)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-sans">
                                  {(area.items || []).map((it: any, itIdx: number) => {
                                    const pType = (it.product_type || 'box').toLowerCase();
                                    const badgeStyles: Record<string, { label: string; cls: string }> = {
                                      box: { label: 'Box', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                                      pieces: { label: 'Pcs', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
                                      sqft: { label: 'Sq.Ft', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                      bags: { label: 'Bags', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                                      nos: { label: 'Nos', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
                                    };
                                    const badge = badgeStyles[pType] || badgeStyles['box'];
                                    const cov = parseFloat(it.coverage_area || 0);
                                    const sqft = parseFloat(it.quantity_sqft || 0);
                                    const rSqft = parseFloat(it.rate_per_sqft || 0);
                                    const baseSqft = parseFloat(it.base_rate_per_sqft || it.rate_per_sqft || 0);
                                    const boxes = parseFloat(it.quantity_boxes || 0);
                                    const rBox = parseFloat(it.rate_per_box || 0);
                                    const baseBox = parseFloat(it.base_rate_per_box || it.rate_per_box || 0);
                                    const discPct = parseFloat(it.discount_percent || 0);
                                    const totalAmt = parseFloat(it.total_amount || 0);

                                    return (
                                      <tr key={it.id || itIdx} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[10px]">
                                          {it.sl_no || itIdx + 1}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-900">
                                          <div className="font-semibold">{it.description}</div>
                                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center space-x-1">
                                            <span>Ref:</span>
                                            <span
                                              className="bg-amber-50 text-amber-800 font-semibold px-1 rounded border border-amber-200/60"
                                              title="Masked product code on Encrypted Export"
                                            >
                                              {it.encrypted_code || derive3LetterCode(it.description)}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600 font-medium">{it.brand || '-'}</td>
                                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                          {it.size || '-'}
                                        </td>
                                        <td className="py-2.5 px-2.5">
                                          <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.cls}`}
                                          >
                                            {badge.label}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">
                                          {pType === 'box' && cov > 0 ? cov.toFixed(1) : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-medium tabular-nums">
                                          {pType === 'box' || pType === 'sqft' ? sqft : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right tabular-nums">
                                          {pType === 'box' || pType === 'sqft' ? (
                                            <div>
                                              <div className="font-mono">₹ {formatCurrency(rSqft)}</div>
                                              {discPct > 0 && (
                                                <div className="text-[10px] text-emerald-700 font-medium">
                                                  (-{discPct}%){' '}
                                                  <span className="line-through text-slate-400">
                                                    ₹{formatCurrency(baseSqft)}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            '-'
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-700 font-semibold tabular-nums">
                                          {pType === 'sqft'
                                            ? '-'
                                            : `${boxes} ${
                                                pType === 'bags'
                                                  ? 'Bags'
                                                  : pType === 'pieces'
                                                  ? 'Pcs'
                                                  : pType === 'nos'
                                                  ? 'Nos'
                                                  : 'Boxes'
                                              }`}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">
                                          {pType === 'sqft' ? (
                                            '-'
                                          ) : (
                                            <div>
                                              <div className="font-mono">₹ {formatCurrency(rBox)}</div>
                                              {discPct > 0 && (
                                                <div className="text-[10px] text-emerald-700 font-medium">
                                                  (-{discPct}%){' '}
                                                  <span className="line-through text-slate-400">
                                                    ₹{formatCurrency(baseBox)}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums text-sm font-mono">
                                          ₹ {formatCurrency(totalAmt)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Totals Summary Card */}
                    <div className="card p-4 bg-slate-50 border border-slate-200">
                      <div className="max-w-xs ml-auto space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Gross Total:</span>
                          <span className="font-mono">₹ {formatCurrency(grossTotal)}</span>
                        </div>

                        {discountAmount > 0 && (
                          <div className="flex justify-between text-rose-600 font-medium">
                            <span>Discount ({discountPercent}%):</span>
                            <span className="font-mono">- ₹ {formatCurrency(discountAmount)}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1">
                          <span>Taxable Amount:</span>
                          <span className="font-mono">₹ {formatCurrency(taxableAmount)}</span>
                        </div>

                        {currentQuotation.tax_type === 'cgst_sgst' ? (
                          <>
                            <div className="flex justify-between text-slate-500 text-[11px]">
                              <span>CGST ({cgstRate}%):</span>
                              <span className="font-mono">₹ {formatCurrency(cgstAmount)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 text-[11px]">
                              <span>SGST ({sgstRate}%):</span>
                              <span className="font-mono">₹ {formatCurrency(sgstAmount)}</span>
                            </div>
                          </>
                        ) : currentQuotation.tax_type === 'igst' ? (
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>IGST ({igstRate}%):</span>
                            <span className="font-mono">₹ {formatCurrency(igstAmount)}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>Tax:</span>
                            <span className="font-semibold text-emerald-700">Exempted</span>
                          </div>
                        )}

                        {Math.abs(roundOff) > 0.001 && (
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>Round Off:</span>
                            <span className="font-mono">₹ {formatCurrency(roundOff)}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-base font-extrabold text-slate-900 border-t-2 border-slate-300 pt-2">
                          <span>Net Total Value:</span>
                          <span className="font-mono text-indigo-950 font-bold">
                            ₹ {formatCurrency(netTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Enlarged Sanitary Image Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-white rounded-xl overflow-hidden shadow-2xl p-2">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/70 text-white hover:bg-slate-900 transition-colors z-10 cursor-pointer"
            >
              <X size={18} />
            </button>
            <img
              src={enlargedImage}
              alt="Enlarged product"
              className="w-full h-full object-contain max-h-[80vh] rounded-lg"
            />
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewPdf && (
        <PdfPreviewModal
          isOpen={!!previewPdf}
          onClose={() => setPreviewPdf(null)}
          pdfUrl={previewPdf.url}
          title={previewPdf.title}
          fileName={previewPdf.fileName}
        />
      )}
    </div>
  );
};
