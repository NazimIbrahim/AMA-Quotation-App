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
}

export const QuotationHistoryModal: React.FC<Props> = ({
  quotationId,
  quotationNumber,
  isOpen,
  onClose,
  onRestored,
}) => {
  const { fetchApi, getVersionPdfUrl } = useServer();
  const { user } = useAuth();

  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [selectedVersionDetail, setSelectedVersionDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<number | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // PDF Preview
  const [previewPdf, setPreviewPdf] = useState<{
    url: string;
    title: string;
    fileName: string;
  } | null>(null);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<{ versions: VersionSummary[]; current_version: number }>(
        `/api/quotations/${quotationId}/versions`
      );
      setVersions(res.versions || []);
      if (res.versions && res.versions.length > 0) {
        // Default to the latest version or current selected version if still in list
        const initial = selectedVersionNum && res.versions.some(v => v.version_number === selectedVersionNum)
          ? selectedVersionNum
          : res.versions[0].version_number;
        setSelectedVersionNum(initial);
        loadVersionDetail(initial);
      }
    } catch (err: any) {
      console.error('Failed to load quotation versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVersionDetail = async (vNum: number) => {
    try {
      setLoadingDetail(true);
      const res = await fetchApi<any>(`/api/quotations/${quotationId}/versions/${vNum}`);
      setSelectedVersionDetail(res);
    } catch (err: any) {
      console.error('Failed to load version details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (isOpen && quotationId) {
      loadVersions();
    } else {
      setSelectedVersionDetail(null);
      setSelectedVersionNum(null);
      setRestoreConfirm(null);
      setEnlargedImage(null);
    }
  }, [isOpen, quotationId]);

  const handleSelectVersion = (vNum: number) => {
    setSelectedVersionNum(vNum);
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

  const handleOpenPdf = (encrypted: boolean = false) => {
    if (!selectedVersionNum) return;
    const url = getVersionPdfUrl(quotationId, selectedVersionNum, encrypted);
    setPreviewPdf({
      url,
      title: `Quotation ${quotationNumber} (v${selectedVersionNum})${encrypted ? ' [Encrypted]' : ''}`,
      fileName: `Quotation_${quotationNumber}_v${selectedVersionNum}${encrypted ? '_Encrypted' : ''}.pdf`,
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
      return (clean.slice(0, 3).padEnd(3, 'X')).toUpperCase() + ' - AMA';
    }
  };

  if (!isOpen) return null;

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

  // Parse monetary numbers safely
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

  return (
    <div className="modal-overlay z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-scale-in">
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <History size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold tracking-tight">Quotation Edit & Version History</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                  {quotationNumber}
                </span>
                <span className="text-[11px] text-slate-400">({versions.length} revisions)</span>
                {isSanitary && (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700">
                    Sanitary Ware
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Inspect previous quotes, track changes by associate/manager, view or print historical quotes, or restore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Left List, Right Detail */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50 min-h-0">
          {/* Left Column: Version Timeline */}
          <div className="w-full md:w-80 border-r border-slate-200 bg-white flex flex-col overflow-y-auto shrink-0">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Revision Timeline
              </span>
              <button
                onClick={loadVersions}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer"
                title="Refresh history"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading version history...</div>
            ) : versions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No revisions found.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {versions.map((v) => {
                  const isSelected = selectedVersionNum === v.version_number;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectVersion(v.version_number)}
                      className={`w-full text-left p-3.5 transition-all flex flex-col space-y-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/70 border-l-4 border-indigo-600 shadow-2xs'
                          : 'hover:bg-slate-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                              v.is_current
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            v{v.version_number}
                          </span>
                          {v.is_current && (
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                              (Active)
                            </span>
                          )}
                        </div>
                        <span className={`badge badge-${v.status} text-[10px]`}>
                          {v.status ? v.status.replace('_', ' ') : ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 font-mono">
                          ₹ {formatCurrency(v.net_total)}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {v.items_count} {v.items_count === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 line-clamp-1 italic">
                        {v.revision_summary}
                      </p>

                      <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-medium text-slate-600 truncate max-w-[150px]">
                          👤 {v.edited_by_name}
                        </span>
                        <span>{new Date(v.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Version Details Preview */}
          <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-5 space-y-4">
            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center py-16">
                <RefreshCw size={24} className="animate-spin text-slate-400" />
              </div>
            ) : !selectedVersionDetail || !currentQuotation ? (
              <div className="flex-1 flex items-center justify-center py-16 text-xs text-slate-400">
                Select a version from the timeline on the left to inspect its complete line items and totals.
              </div>
            ) : (
              <>
                {/* Snapshot Action Banner */}
                <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold font-mono text-slate-900">
                        Version {selectedVersionDetail.version_number}
                      </span>
                      {selectedVersionNum === versions[0]?.version_number ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Active Current Version
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Historical Revision
                        </span>
                      )}
                      <span className={`badge badge-${currentQuotation.status}`}>
                        {currentQuotation.status ? currentQuotation.status.replace('_', ' ') : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Saved on{' '}
                      <strong>{new Date(selectedVersionDetail.created_at).toLocaleString('en-GB')}</strong> by{' '}
                      <span className="font-semibold text-slate-800">{selectedVersionDetail.edited_by_name}</span>
                      {selectedVersionDetail.revision_summary && (
                        <span className="ml-2 text-slate-600 italic">
                          — "{selectedVersionDetail.revision_summary}"
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* View Historical PDF */}
                    <button
                      type="button"
                      onClick={() => handleOpenPdf(false)}
                      className="btn btn-secondary btn-sm flex items-center space-x-1 cursor-pointer"
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
                    {selectedVersionNum !== versions[0]?.version_number && (
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
                  <div className="card p-3 space-y-1 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Customer Information
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

                  <div className="card p-3 space-y-1 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Sales Associates
                    </span>
                    <p className="font-semibold text-slate-900">
                      Primary: <span className="font-bold">{currentQuotation.sales_person_name || 'Associate'}</span>
                    </p>
                    {currentQuotation.assisted_sales_person_name && (
                      <p className="text-indigo-800 text-[11px] font-medium">
                        Assisted: {currentQuotation.assisted_sales_person_name} (
                        {Number(currentQuotation.assisted_sales_share_percent || 50).toFixed(0)}%)
                      </p>
                    )}
                    <p className="text-slate-500 text-[11px]">
                      Quote Date: {currentQuotation.quotation_date ? new Date(currentQuotation.quotation_date).toLocaleDateString('en-GB') : '-'}
                    </p>
                    {currentQuotation.project_name && (
                      <p className="text-slate-500 text-[11px]">Project: {currentQuotation.project_name}</p>
                    )}
                  </div>

                  <div className="card p-3 space-y-1 text-xs bg-gradient-to-br from-slate-50 to-indigo-50/40">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Approval & Status
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

                {/* Line Items Table: Sanitary Ware vs Tiles */}
                {isSanitary ? (
                  /* Dedicated Sanitary Ware Itemized Layout */
                  <div className="card overflow-hidden border border-slate-200">
                    <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span>Sanitary Ware Line Items (Version {selectedVersionDetail.version_number})</span>
                      </div>
                      <span className="text-slate-500 font-normal">
                        Total: {allSanitaryItems.length} items (
                        {allSanitaryItems.reduce((acc, it) => acc + (parseFloat(it.quantity_boxes || it.quantity) || 1), 0)} Nos)
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/50 text-[11px]">
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
                              const mrp = parseFloat(item.mrp_price || item.base_rate_per_box || item.rate_per_box || 0);
                              const ratePerUnit = parseFloat(item.rate_per_box || item.base_rate_per_box || item.rate_per_sqft || 0);
                              const discPct = parseFloat(item.discount_percent || 0);
                              const totalAmt = parseFloat(item.total_amount || 0);
                              const qtyNos = parseFloat(item.quantity_boxes || item.quantity || 1);

                              return (
                                <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
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
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-950 tabular-nums">
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
                        <span>Itemized Areas & Tile Specifications (Version {selectedVersionDetail.version_number})</span>
                      </h3>
                      <span className="text-xs text-slate-500">
                        {currentAreas.length} {currentAreas.length === 1 ? 'Area' : 'Areas'}
                      </span>
                    </div>

                    {currentAreas.map((area: any, aIdx: number) => (
                      <div key={area.id || aIdx} className="card overflow-hidden border border-slate-200">
                        <div className="px-4 py-2 bg-slate-100/90 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800 uppercase tracking-wide">
                          <span>AREA: {area.area_name || `Area ${aIdx + 1}`}</span>
                          <span className="text-slate-500 font-normal lowercase">
                            {(area.items || []).length} items
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/50 text-[11px]">
                                <th className="py-2 px-3 text-center w-8">#</th>
                                <th className="py-2 px-3">Description</th>
                                <th className="py-2 px-3">Brand</th>
                                <th className="py-2 px-3">Size</th>
                                <th className="py-2 px-2.5">Type</th>
                                <th className="py-2 px-3 text-right">Cov/Box</th>
                                <th className="py-2 px-3 text-right">Sqft</th>
                                <th className="py-2 px-3 text-right">Rate/Sqft</th>
                                <th className="py-2 px-3 text-right">Boxes/Qty</th>
                                <th className="py-2 px-3 text-right">Rate/Unit</th>
                                <th className="py-2 px-3 text-right">Total (₹)</th>
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
                                  <tr key={it.id || itIdx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">
                                      {it.sl_no || itIdx + 1}
                                    </td>
                                    <td className="py-2 px-3 text-slate-900">
                                      <div className="font-semibold">{it.description}</div>
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center space-x-1">
                                        <span>Ref:</span>
                                        <span className="bg-amber-50 text-amber-800 font-semibold px-1 rounded border border-amber-200/60" title="Masked product code on Encrypted Export">
                                          {it.encrypted_code || derive3LetterCode(it.description)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 text-slate-600">{it.brand || '-'}</td>
                                    <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">{it.size || '-'}</td>
                                    <td className="py-2 px-2.5">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.cls}`}>
                                        {badge.label}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                                      {pType === 'box' && cov > 0 ? cov.toFixed(1) : '-'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium tabular-nums">
                                      {pType === 'box' || pType === 'sqft' ? sqft : '-'}
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                      {pType === 'box' || pType === 'sqft' ? (
                                        <div>
                                          <div>₹ {formatCurrency(rSqft)}</div>
                                          {discPct > 0 && (
                                            <div className="text-[10px] text-emerald-700 font-medium">
                                              (-{discPct}%) <span className="line-through text-slate-400">₹{formatCurrency(baseSqft)}</span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-700 font-semibold tabular-nums">
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
                                    <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                                      {pType === 'sqft' ? (
                                        '-'
                                      ) : (
                                        <div>
                                          <div>₹ {formatCurrency(rBox)}</div>
                                          {discPct > 0 && (
                                            <div className="text-[10px] text-emerald-700 font-medium">
                                              (-{discPct}%) <span className="line-through text-slate-400">₹{formatCurrency(baseBox)}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                                      <div>₹ {formatCurrency(totalAmt)}</div>
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
                        <span>
                          Discount ({discountPercent}%):
                        </span>
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

                    <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t-2 border-slate-300 pt-2">
                      <span>Net Total:</span>
                      <span className="font-mono text-indigo-900">
                        ₹ {formatCurrency(netTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {currentQuotation.special_notes && (
                  <div className="card p-3 text-xs bg-amber-50/50 border border-amber-200 text-amber-900">
                    <strong className="block font-bold mb-0.5">Special Terms / Notes:</strong>
                    <p className="whitespace-pre-line text-[11px]">{currentQuotation.special_notes}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-400">
            Every modification is versioned to maintain a full audit trail.
          </span>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm cursor-pointer">
            Close History
          </button>
        </div>
      </div>

      {/* Historical PDF Preview Modal */}
      {previewPdf && (
        <PdfPreviewModal
          isOpen={true}
          pdfUrl={previewPdf.url}
          title={previewPdf.title}
          fileName={previewPdf.fileName}
          onClose={() => setPreviewPdf(null)}
        />
      )}

      {/* Enlarged Image Lightbox Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div
            className="relative bg-white rounded-2xl p-2 max-w-lg max-h-[85vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={enlargedImage}
              alt="Sanitary Product"
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
            />
            <button
              type="button"
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white p-1.5 rounded-full transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
