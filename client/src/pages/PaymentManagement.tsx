import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import { Payment, Quotation } from '../types';
import { CreditCard, Plus, Printer, RefreshCw, X, AlertCircle } from 'lucide-react';
import { PdfPreviewModal } from '../components/PdfPreviewModal';

export const PaymentManagement: React.FC = () => {
  const { fetchApi, getReceiptUrl, subscribeToEvents } = useServer();
  const { user } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCollected, setTotalCollected] = useState(0);

  // New Payment Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('Bank Transfer (NEFT/RTGS/IMPS)');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF Preview State
  const [previewPdf, setPreviewPdf] = useState<{ url: string; title: string; fileName: string } | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/api/payments?limit=50');
      setPayments(res.payments || []);
      setTotalCollected(res.summary?.totalCollected || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      if (['PAYMENT_RECORDED'].includes(event.type)) {
        loadPayments();
      }
    });
    return () => unsubscribe();
  }, []);

  const openPaymentModal = async () => {
    setError(null);
    try {
      const res = await fetchApi('/api/quotations?status=approved&limit=100');
      setQuotations(res.quotations || []);
      if (res.quotations && res.quotations.length > 0) {
        setSelectedQuotationId(res.quotations[0].id);
        setAmount(String(res.quotations[0].balance_due || ''));
      }
      setModalOpen(true);
    } catch (err) {
      alert('Failed to load approved quotations');
    }
  };

  const selectedQuotation = quotations.find((q) => q.id === selectedQuotationId);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedQuotationId || !amount) {
      setError('Please select a quotation and specify the payment amount');
      return;
    }

    setSubmitting(true);
    try {
      await fetchApi('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          quotation_id: selectedQuotationId,
          amount: parseFloat(amount),
          payment_mode: paymentMode,
          payment_date: paymentDate,
          reference_number: referenceNumber,
          notes,
        }),
      });

      setModalOpen(false);
      setAmount('');
      setReferenceNumber('');
      setNotes('');
      loadPayments();
    } catch (err: any) {
      setError(err.message || 'Payment submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReceipt = (p: Payment) => {
    const url = getReceiptUrl(p.id);
    setPreviewPdf({
      url,
      title: `Payment Receipt ${p.payment_number} — ${p.customer_name}`,
      fileName: `Receipt_${p.payment_number}.pdf`,
    });
  };

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  };

  return (
    <div className="flex-1 p-6 space-y-4 overflow-y-auto max-w-7xl">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Payments & Receipts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Total Verified Collections: ₹ {formatCurrency(totalCollected)} • Linked directly to quotation accounts
          </p>
        </div>

        <button onClick={openPaymentModal} className="btn btn-primary btn-sm">
          <Plus size={14} />
          <span>Record New Payment</span>
        </button>
      </div>

      {/* Payments Table */}
      <div className="card overflow-hidden">
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Payment Receipts Audit Ledger
          </span>
          <button
            onClick={loadPayments}
            className="btn btn-secondary btn-xs"
            title="Refresh payments"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold text-[11px]">
                <th className="py-2.5 px-3">Receipt Ref</th>
                <th className="py-2.5 px-3">Payment Date</th>
                <th className="py-2.5 px-3">Quotation Ref</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Payment Mode</th>
                <th className="py-2.5 px-3">Ref / Cheque #</th>
                <th className="py-2.5 px-3 text-right">Amount Received</th>
                <th className="py-2.5 px-3">Recorded By</th>
                <th className="py-2.5 px-3 text-center">Receipt PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="animate-spin inline mr-2 text-slate-600" size={16} />
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No payment receipts found.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                      {p.payment_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(p.payment_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-800">{p.quotation_number}</td>
                    <td className="py-2.5 px-3 text-slate-900 font-medium">{p.customer_name}</td>
                    <td className="py-2.5 px-3 text-slate-700">{p.payment_mode}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {p.reference_number || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700 tabular-nums">
                      ₹ {formatCurrency(p.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{p.recorded_by_name || 'System'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleOpenReceipt(p)}
                        className="btn btn-secondary btn-xs"
                        title="Print / View Receipt PDF"
                      >
                        <Printer size={12} />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="card shadow-xl w-full max-w-lg p-5 border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <div className="flex items-center space-x-2">
                <CreditCard size={17} className="text-slate-800" />
                <h2 className="text-sm font-bold text-slate-900 uppercase">
                  Record Quotation Payment
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={17} />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs flex items-center space-x-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Quotation *</label>
                <select
                  className="input input-sm"
                  value={selectedQuotationId || ''}
                  onChange={(e) => {
                    const qId = parseInt(e.target.value, 10);
                    setSelectedQuotationId(qId);
                    const match = quotations.find((q) => q.id === qId);
                    if (match) setAmount(String(match.balance_due || ''));
                  }}
                  required
                >
                  <option value="">-- Choose Approved Quotation --</option>
                  {quotations.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.quotation_number} - {q.customer_name} (Due: ₹ {formatCurrency(q.balance_due || 0)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedQuotation && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Quotation Net Total:</span>
                    <span className="font-semibold tabular-nums">
                      ₹ {formatCurrency(selectedQuotation.net_total)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Already Received:</span>
                    <span className="font-semibold text-emerald-700 tabular-nums">
                      ₹ {formatCurrency(selectedQuotation.total_paid || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-slate-200 pt-1 text-slate-900">
                    <span>Outstanding Balance Due:</span>
                    <span className="tabular-nums">
                      ₹ {formatCurrency(selectedQuotation.balance_due || 0)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Amount to Collect (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input input-sm font-bold text-slate-900 tabular-nums"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    className="input input-sm"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Payment Mode *
                  </label>
                  <select
                    className="input input-sm"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="Bank Transfer (NEFT/RTGS/IMPS)">
                      Bank Transfer (NEFT/RTGS/IMPS)
                    </option>
                    <option value="UPI (GPay/PhonePe/Paytm)">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card Swipe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Reference / Cheque Number
                  </label>
                  <input
                    type="text"
                    className="input input-sm font-mono"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Txn ID / Cheque #004521"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Internal Notes</label>
                <input
                  type="text"
                  className="input input-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 50% order booking advance"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Generate Receipt & Clear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Receipt Preview Modal */}
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
