import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import { Quotation, QuotationArea, Payment } from '../types';
import {
  ArrowLeft,
  Printer,
  Edit,
  CreditCard,
  Building,
  User,
  Users,
  IndianRupee,
  RefreshCw,
  Receipt,
} from 'lucide-react';
import { PdfPreviewModal } from '../components/PdfPreviewModal';

interface Props {
  quotationId: number;
  onBack: () => void;
  onEdit: (id: number) => void;
  onRecordPayment: (quotationId: number) => void;
}

export const QuotationDetail: React.FC<Props> = ({
  quotationId,
  onBack,
  onEdit,
  onRecordPayment,
}) => {
  const { fetchApi, getPdfUrl, getReceiptUrl, subscribeToEvents } = useServer();
  const { user } = useAuth();

  const [data, setData] = useState<{
    quotation: Quotation;
    areas: QuotationArea[];
    payments: Payment[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // PDF Preview State
  const [previewPdf, setPreviewPdf] = useState<{ url: string; title: string; fileName: string } | null>(null);

  const loadDetail = async () => {
    try {
      setLoading(true);
      const res = await fetchApi(`/api/quotations/${quotationId}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load quotation detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
    const unsubscribe = subscribeToEvents((event) => {
      if (
        (['QUOTATION_UPDATED', 'QUOTATION_STATUS_CHANGED', 'PAYMENT_RECORDED'].includes(event.type) &&
          event.payload?.id === quotationId) ||
        event.payload?.quotation_id === quotationId
      ) {
        loadDetail();
      }
    });
    return () => unsubscribe();
  }, [quotationId]);

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  };

  const handleOpenQuotationPdf = () => {
    if (!data) return;
    const url = getPdfUrl(data.quotation.id);
    setPreviewPdf({
      url,
      title: `Quotation ${data.quotation.quotation_number} — ${data.quotation.customer_name}`,
      fileName: `Quotation_${data.quotation.quotation_number}.pdf`,
    });
  };

  const handleOpenReceiptPdf = (p: Payment) => {
    const url = getReceiptUrl(p.id);
    setPreviewPdf({
      url,
      title: `Receipt ${p.payment_number} — ${p.customer_name}`,
      fileName: `Receipt_${p.payment_number}.pdf`,
    });
  };

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="text-center">
          <RefreshCw className="animate-spin text-slate-800 mx-auto mb-2" size={24} />
          <p className="text-xs font-semibold text-slate-600">Loading Quotation Record...</p>
        </div>
      </div>
    );
  }

  const { quotation, areas = [], payments = [] } = data;

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto max-w-7xl">
      {/* Top Header & Actions */}
      <div className="card p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="btn btn-secondary btn-sm p-1.5"
            title="Back to Quotation List"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold font-mono text-slate-900 tracking-tight">
                {quotation.quotation_number}
              </h1>
              <span className={`badge badge-${quotation.status}`}>{quotation.status}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Issued on {new Date(quotation.quotation_date).toLocaleDateString('en-GB')} by{' '}
              <span className="font-semibold text-slate-700">{quotation.sales_person_name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(quotation.id)}
            className="btn btn-secondary btn-sm"
          >
            <Edit size={13} />
            <span>Edit</span>
          </button>

          <button
            onClick={handleOpenQuotationPdf}
            className="btn btn-secondary btn-sm"
          >
            <Printer size={13} />
            <span>View & Export PDF</span>
          </button>

          <button
            onClick={() => onRecordPayment(quotation.id)}
            className="btn btn-primary btn-sm"
          >
            <CreditCard size={13} />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Customer Box */}
        <div className="card p-4 text-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 text-slate-900 font-bold tracking-wider uppercase text-[11px] mb-1">
            <User size={13} className="text-slate-700" />
            <span>Customer Profile</span>
          </div>
          <p className="font-bold text-slate-900 text-sm">{quotation.customer_name}</p>
          <p className="text-slate-600 font-mono">Contact: {quotation.customer_phone}</p>
          {quotation.customer_gstin && (
            <p className="text-slate-500 font-mono">GSTIN: {quotation.customer_gstin}</p>
          )}
          <p className="text-slate-600 mt-1">
            Site: {quotation.delivery_address || 'Ex-showroom Delivery'}
          </p>
        </div>

        {/* Project Box */}
        <div className="card p-4 text-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 text-slate-900 font-bold tracking-wider uppercase text-[11px] mb-1">
            <Building size={13} className="text-slate-700" />
            <span>Project & Sales Associate</span>
          </div>
          <p className="font-bold text-slate-900 text-sm">
            {quotation.project_name || 'Standard Residential Order'}
          </p>
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between text-slate-700">
              <span>Lead Closer:</span>
              <span className="font-semibold text-slate-900">{quotation.sales_person_name}</span>
            </div>

            {quotation.assisted_sales_person_name && (
              <div className="p-2 bg-indigo-50/70 rounded border border-indigo-100 text-[11px] space-y-1.5 my-1">
                <div className="flex items-center justify-between font-medium text-indigo-950">
                  <span className="inline-flex items-center space-x-1">
                    <Users size={12} className="text-indigo-600" />
                    <span>Assisted Sale (Co-Closer):</span>
                  </span>
                  <span className="font-bold">{quotation.assisted_sales_person_name}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 border-t border-indigo-100/80 pt-1">
                  <div>
                    <span className="text-slate-500">Lead ({Number(quotation.primary_sales_share_percent || 50).toFixed(0)}%):</span>{' '}
                    <strong className="text-blue-700 font-mono">₹{formatCurrency(quotation.primary_sales_share_amount || 0)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Assisted ({Number(quotation.assisted_sales_share_percent || 50).toFixed(0)}%):</span>{' '}
                    <strong className="text-emerald-700 font-mono">₹{formatCurrency(quotation.assisted_sales_share_amount || 0)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="text-slate-600 pt-0.5">
            Quotation Date: {new Date(quotation.quotation_date).toLocaleDateString('en-GB')}
          </p>
          {quotation.approved_by_name && (
            <p className="text-emerald-700 font-medium">Approved by: {quotation.approved_by_name}</p>
          )}
        </div>

        {/* Financial Summary Box */}
        <div className="card p-4 text-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 text-slate-900 font-bold tracking-wider uppercase text-[11px] mb-1">
            <IndianRupee size={13} className="text-slate-700" />
            <span>Financial Settlement</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Net Total:</span>
            <span className="font-bold text-slate-900 text-sm tabular-nums">
              ₹ {formatCurrency(quotation.net_total)}
            </span>
          </div>
          <div className="flex justify-between text-emerald-700 font-medium">
            <span>Total Paid:</span>
            <span className="tabular-nums font-semibold">
              ₹ {formatCurrency(quotation.total_paid || 0)}
            </span>
          </div>
          <div className="flex justify-between text-amber-700 font-bold border-t border-slate-200 pt-1.5">
            <span>Balance Due:</span>
            <span className="tabular-nums">₹ {formatCurrency(quotation.balance_due || 0)}</span>
          </div>
        </div>
      </div>

      {/* Room-wise Items */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Itemized Areas & Tile Specifications
        </h2>

        {areas.map((area) => (
          <div key={area.id} className="card overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-bold text-xs text-slate-900 uppercase tracking-wide">
              AREA: {area.area_name}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50/50 text-[11px]">
                    <th className="py-2 px-3 text-center w-8">Sl</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Brand</th>
                    <th className="py-2 px-3">Size</th>
                    <th className="py-2 px-3 text-right">Cov/Box</th>
                    <th className="py-2 px-3 text-right">Sqft</th>
                    <th className="py-2 px-3 text-right">Rate/Sqft</th>
                    <th className="py-2 px-3 text-right">Boxes</th>
                    <th className="py-2 px-3 text-right">Rate/Box</th>
                    <th className="py-2 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {area.items && area.items.length > 0 ? (
                    area.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">
                          {item.sl_no}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{item.description}</td>
                        <td className="py-2 px-3 text-slate-600">{item.brand}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{item.size}</td>
                        <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                          {Number(item.coverage_area).toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium tabular-nums">
                          {item.quantity_sqft}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          ₹ {formatCurrency(item.rate_per_sqft)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                          {item.quantity_boxes}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                          ₹ {formatCurrency(item.rate_per_box)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                          ₹ {formatCurrency(item.total_amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-4 text-center text-slate-400">
                        No line items recorded in this area.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Payment History */}
      <div className="card p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Payments & Receipts History
            </h2>
            <p className="text-[11px] text-slate-500">
              Payments recorded and linked to this quotation
            </p>
          </div>
          <button
            onClick={() => onRecordPayment(quotation.id)}
            className="btn btn-secondary btn-sm"
          >
            <CreditCard size={13} />
            <span>Record Payment</span>
          </button>
        </div>

        {payments && payments.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-md">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 bg-slate-50 text-[11px]">
                  <th className="py-2 px-3">Receipt Ref</th>
                  <th className="py-2 px-3">Payment Date</th>
                  <th className="py-2 px-3">Mode</th>
                  <th className="py-2 px-3">Reference / Txn #</th>
                  <th className="py-2 px-3 text-right">Amount Received</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-center">Receipt PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                      {p.payment_number}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {new Date(p.payment_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-2 px-3 text-slate-700">{p.payment_mode}</td>
                    <td className="py-2 px-3 text-slate-500 font-mono">{p.reference_number || '-'}</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-700 tabular-nums">
                      ₹ {formatCurrency(p.amount)}
                    </td>
                    <td className="py-2 px-3">
                      <span className="badge badge-approved">{p.status}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleOpenReceiptPdf(p)}
                        className="btn btn-secondary btn-xs"
                        title="View Official Receipt"
                      >
                        <Receipt size={12} />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-6 text-center">
            No payments recorded against this quotation yet.
          </p>
        )}
      </div>

      {/* In-App PDF Preview Modal */}
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
