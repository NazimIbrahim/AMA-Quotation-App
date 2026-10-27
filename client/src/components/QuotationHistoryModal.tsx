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
        // Default to latest version or the selected one
        const initial = selectedVersionNum || res.versions[0].version_number;
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

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  };

  if (!isOpen) return null;

  const currentSnapshot = selectedVersionDetail?.snapshot;
  const currentQuotation = currentSnapshot?.quotation;
  const currentAreas = currentSnapshot?.areas || [];

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
              </div>
              <p className="text-[11px] text-slate-400">
                Inspect previous quotes, track changes by associate/manager, view or print historical quotes, or restore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
                className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
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
                      className="btn btn-secondary btn-sm flex items-center space-x-1"
                      title="Download or preview PDF for this historical version"
                    >
                      <Printer size={13} className="text-slate-600" />
                      <span>Print / PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenPdf(true)}
                      className="btn btn-secondary btn-sm flex items-center space-x-1 text-amber-900 bg-amber-50 border-amber-300"
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
                              className="btn btn-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
                            >
                              {restoring ? 'Restoring...' : 'Yes, Restore'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRestoreConfirm(null)}
                              className="btn btn-xs btn-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRestoreConfirm(selectedVersionNum)}
                            className="btn btn-primary btn-sm flex items-center space-x-1 shadow-xs"
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
                    <p className="font-bold text-slate-900">{currentQuotation.customer_name}</p>
                    <p className="text-slate-600 font-mono">{currentQuotation.customer_phone}</p>
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
                      Primary: <span className="font-bold">{currentQuotation.sales_person_name}</span>
                    </p>
                    {currentQuotation.assisted_sales_person_name && (
                      <p className="text-indigo-800 text-[11px] font-medium">
                        Assisted: {currentQuotation.assisted_sales_person_name} (
                        {Number(currentQuotation.assisted_sales_share_percent || 50).toFixed(0)}%)
                      </p>
                    )}
                    <p className="text-slate-500 text-[11px]">
                      Quote Date: {new Date(currentQuotation.quotation_date).toLocaleDateString('en-GB')}
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
                      <p className="text-emerald-800 text-[11px] font-bold">
                        Approved by Store Manager: {currentQuotation.approved_by_name}
                      </p>
                    ) : (
                      <p className="text-amber-700 text-[11px]">Pending Manager Approval</p>
                    )}
                    {currentQuotation.manager_approval_note && (
                      <p className="text-[11px] text-slate-500 italic">
                        "{currentQuotation.manager_approval_note}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Line Items Table by Area */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                      <FileText size={14} className="text-indigo-600" />
                      <span>Itemized Quote Content (Version {selectedVersionDetail.version_number})</span>
                    </h3>
                    <span className="text-xs text-slate-500">
                      {currentAreas.length} {currentAreas.length === 1 ? 'Area' : 'Areas'}
                    </span>
                  </div>

                  {currentAreas.map((area: any, aIdx: number) => (
                    <div key={area.id || aIdx} className="card overflow-hidden border border-slate-200">
                      <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                        <span>{area.area_name || `Area ${aIdx + 1}`}</span>
                        <span className="text-slate-500 font-normal">
                          {(area.items || []).length} items
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="table table-compact w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50/80 text-[11px] text-slate-500 border-b border-slate-200">
                              <th className="py-2 px-2 text-center w-8">#</th>
                              <th className="py-2 px-3 text-left">Description</th>
                              <th className="py-2 px-2 text-left">Brand</th>
                              <th className="py-2 px-2 text-left">Size</th>
                              <th className="py-2 px-2 text-right">Qty</th>
                              <th className="py-2 px-2 text-right">Rate</th>
                              <th className="py-2 px-2 text-right">Disc %</th>
                              <th className="py-2 px-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-sans">
                            {(area.items || []).map((it: any, itIdx: number) => (
                              <tr key={it.id || itIdx} className="hover:bg-slate-50/50">
                                <td className="py-2 px-2 text-center text-slate-400 font-mono text-[10px]">
                                  {it.sl_no || itIdx + 1}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {it.description}
                                  {it.item_code && (
                                    <span className="ml-1 text-[10px] text-slate-400 font-mono">
                                      ({it.item_code})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-slate-600">{it.brand || '-'}</td>
                                <td className="py-2 px-2 text-slate-600 font-mono text-[11px]">
                                  {it.size || '-'}
                                </td>
                                <td className="py-2 px-2 text-right font-mono font-medium text-slate-800">
                                  {it.quantity_sqft > 0 ? (
                                    <span>{it.quantity_sqft} sqft</span>
                                  ) : (
                                    <span>{it.quantity_boxes || it.quantity || 0} nos</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-700">
                                  ₹ {formatCurrency(it.rate_per_sqft || it.rate_per_box || 0)}
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600">
                                  {it.discount_percent > 0 ? `${it.discount_percent}%` : '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                  ₹ {formatCurrency(it.total_amount || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Summary Card */}
                <div className="card p-4 bg-slate-50 border border-slate-200">
                  <div className="max-w-xs ml-auto space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Gross Total:</span>
                      <span className="font-mono">₹ {formatCurrency(currentQuotation.gross_total)}</span>
                    </div>

                    {currentQuotation.discount_amount > 0 && (
                      <div className="flex justify-between text-rose-600 font-medium">
                        <span>
                          Discount ({currentQuotation.discount_percent}%):
                        </span>
                        <span className="font-mono">- ₹ {formatCurrency(currentQuotation.discount_amount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1">
                      <span>Taxable Amount:</span>
                      <span className="font-mono">₹ {formatCurrency(currentQuotation.taxable_amount)}</span>
                    </div>

                    {currentQuotation.tax_type === 'cgst_sgst' ? (
                      <>
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>CGST ({currentQuotation.cgst_rate}%):</span>
                          <span className="font-mono">₹ {formatCurrency(currentQuotation.cgst_amount)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>SGST ({currentQuotation.sgst_rate}%):</span>
                          <span className="font-mono">₹ {formatCurrency(currentQuotation.sgst_amount)}</span>
                        </div>
                      </>
                    ) : currentQuotation.tax_type === 'igst' ? (
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>IGST ({currentQuotation.igst_rate}%):</span>
                        <span className="font-mono">₹ {formatCurrency(currentQuotation.igst_amount)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Tax:</span>
                        <span>Exempted</span>
                      </div>
                    )}

                    {currentQuotation.round_off !== 0 && (
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Round Off:</span>
                        <span className="font-mono">₹ {formatCurrency(currentQuotation.round_off)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t-2 border-slate-300 pt-2">
                      <span>Net Total:</span>
                      <span className="font-mono text-indigo-900">
                        ₹ {formatCurrency(currentQuotation.net_total)}
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
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
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
    </div>
  );
};
