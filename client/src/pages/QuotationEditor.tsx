import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import { Quotation, QuotationArea, QuotationItem, Customer, TileBrand, BrandSizeCoverage } from '../types';
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Printer,
  UserCheck,
  Building2,
  Calendar,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { PdfPreviewModal } from '../components/PdfPreviewModal';
import { numberToWordsIndian } from '../utils/numberToWords';

interface Props {
  quotationId?: number | null;
  onBack: () => void;
  onSaved: (id: number) => void;
}

export const QuotationEditor: React.FC<Props> = ({ quotationId, onBack, onSaved }) => {
  const { fetchApi, getPdfUrl } = useServer();
  const { user } = useAuth();

  // Reference data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<TileBrand[]>([]);
  const [coverages, setCoverages] = useState<BrandSizeCoverage[]>([]);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [projectName, setProjectName] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [specialNotes, setSpecialNotes] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxType, setTaxType] = useState<'cgst_sgst' | 'igst' | 'exempt'>('cgst_sgst');

  const [version, setVersion] = useState<number>(1);
  const [quotationNumber, setQuotationNumber] = useState<string>('');

  // Areas and Items
  const [areas, setAreas] = useState<Array<{ name: string; items: QuotationItem[] }>>([
    {
      name: 'GROUND FLOOR',
      items: [
        {
          sl_no: 1,
          description: 'OMBRA EMERALD ULTRA - SS',
          size: '1200X1800',
          brand: 'Simpolo Ceramics',
          coverage_area: 46.5,
          quantity_sqft: 326,
          rate_per_sqft: 145,
          quantity_boxes: 7,
          rate_per_box: 6743,
          total_amount: 47197.5,
        },
      ],
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF Preview State
  const [previewPdf, setPreviewPdf] = useState<{ url: string; title: string; fileName: string } | null>(null);

  // Load Reference Data
  useEffect(() => {
    fetchApi('/api/customers?limit=100').then((res) => setCustomers(res.customers || [])).catch(() => {});
    fetchApi('/api/products/brands').then((res) => setBrands(res.brands || [])).catch(() => {});
    fetchApi('/api/products/coverages').then((res) => setCoverages(res.coverages || [])).catch(() => {});
  }, []);

  // Load Existing Quotation if editing
  useEffect(() => {
    if (quotationId) {
      fetchApi(`/api/quotations/${quotationId}`)
        .then((res) => {
          const q: Quotation = res.quotation;
          setCustomerName(q.customer_name);
          setCustomerPhone(q.customer_phone);
          setCustomerGstin(q.customer_gstin || '');
          setDeliveryAddress(q.delivery_address || '');
          setSiteLocation(q.site_location || '');
          setProjectName(q.project_name || '');
          setQuotationDate(q.quotation_date.split('T')[0]);
          setSpecialNotes(q.special_notes || '');
          setDiscountPercent(parseFloat(String(q.discount_percent)) || 0);
          setDiscountAmount(parseFloat(String(q.discount_amount)) || 0);
          setTaxType(q.tax_type || 'cgst_sgst');
          setVersion(q.version || 1);
          setQuotationNumber(q.quotation_number);

          if (Array.isArray(res.areas) && res.areas.length > 0) {
            setAreas(
              res.areas.map((a: any) => ({
                name: a.area_name,
                items: a.items || [],
              }))
            );
          }
        })
        .catch((err) => setError(err.message));
    }
  }, [quotationId]);

  // Customer Select Handler
  const handleSelectCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = parseInt(e.target.value, 10);
    const selected = customers.find((c) => c.id === custId);
    if (selected) {
      setCustomerName(selected.name);
      setCustomerPhone(selected.mobile_number);
      setCustomerGstin(selected.gstin || '');
      setDeliveryAddress(selected.delivery_address || '');
      setSiteLocation(selected.site_location || '');
    }
  };

  // Add Room/Area
  const handleAddArea = () => {
    setAreas([...areas, { name: `ROOM / AREA ${areas.length + 1}`, items: [] }]);
  };

  const handleRemoveArea = (areaIdx: number) => {
    if (areas.length === 1) {
      alert('Quotation must contain at least one area.');
      return;
    }
    setAreas(areas.filter((_, idx) => idx !== areaIdx));
  };

  // Add Item to Area
  const handleAddItem = (areaIdx: number) => {
    const newAreas = [...areas];
    const defaultBrand = brands[0]?.name || 'Simpolo Ceramics';
    newAreas[areaIdx].items.push({
      sl_no: 1,
      description: 'Vitrified Surface Tile',
      size: '1200X1800',
      brand: defaultBrand,
      coverage_area: 46.5,
      quantity_sqft: 100,
      rate_per_sqft: 120,
      quantity_boxes: 2.15,
      rate_per_box: 5580,
      total_amount: 12000,
    });
    setAreas(newAreas);
  };

  const handleRemoveItem = (areaIdx: number, itemIdx: number) => {
    const newAreas = [...areas];
    newAreas[areaIdx].items = newAreas[areaIdx].items.filter((_, idx) => idx !== itemIdx);
    setAreas(newAreas);
  };

  // Item Field Change with Bidirectional Sqft <-> Box Calculation
  const handleItemChange = (
    areaIdx: number,
    itemIdx: number,
    field: keyof QuotationItem,
    val: any
  ) => {
    const newAreas = [...areas];
    const item = { ...newAreas[areaIdx].items[itemIdx], [field]: val };

    const cov = parseFloat(String(item.coverage_area)) || 1;
    let sqft = parseFloat(String(item.quantity_sqft)) || 0;
    let rSqft = parseFloat(String(item.rate_per_sqft)) || 0;
    let boxes = parseFloat(String(item.quantity_boxes)) || 0;
    let rBox = parseFloat(String(item.rate_per_box)) || 0;

    // Automatic calculation dependencies
    if (field === 'size') {
      const match = coverages.find((c) => c.size.toLowerCase() === String(val).toLowerCase());
      if (match) {
        item.coverage_area = match.coverage_sqft;
        item.rate_per_sqft = match.default_rate_sqft || rSqft;
        item.rate_per_box = match.default_rate_box || (match.default_rate_sqft * match.coverage_sqft);
      }
    } else if (field === 'quantity_sqft') {
      sqft = parseFloat(val) || 0;
      boxes = cov > 0 ? parseFloat((sqft / cov).toFixed(2)) : 0;
      item.quantity_boxes = boxes;
      item.total_amount = parseFloat((sqft * rSqft).toFixed(2));
    } else if (field === 'quantity_boxes') {
      boxes = parseFloat(val) || 0;
      sqft = cov > 0 ? parseFloat((boxes * cov).toFixed(2)) : 0;
      item.quantity_sqft = sqft;
      item.total_amount = parseFloat((sqft * rSqft).toFixed(2));
    } else if (field === 'rate_per_sqft') {
      rSqft = parseFloat(val) || 0;
      rBox = cov > 0 ? parseFloat((rSqft * cov).toFixed(2)) : 0;
      item.rate_per_box = rBox;
      item.total_amount = parseFloat((sqft * rSqft).toFixed(2));
    } else if (field === 'rate_per_box') {
      rBox = parseFloat(val) || 0;
      rSqft = cov > 0 ? parseFloat((rBox / cov).toFixed(2)) : 0;
      item.rate_per_sqft = rSqft;
      item.total_amount = parseFloat((sqft * rSqft).toFixed(2));
    } else if (field === 'coverage_area') {
      const newCov = parseFloat(val) || 1;
      boxes = newCov > 0 ? parseFloat((sqft / newCov).toFixed(2)) : 0;
      item.quantity_boxes = boxes;
      item.rate_per_box = parseFloat((rSqft * newCov).toFixed(2));
    }

    newAreas[areaIdx].items[itemIdx] = item;
    setAreas(newAreas);
  };

  // Re-number SL Nos across all items
  let runningSl = 1;
  areas.forEach((a) => {
    a.items.forEach((it) => {
      it.sl_no = runningSl++;
    });
  });

  // Financial Totals Calculation
  let grossTotal = 0;
  areas.forEach((a) => {
    a.items.forEach((it) => {
      grossTotal += parseFloat(String(it.total_amount)) || 0;
    });
  });
  grossTotal = parseFloat(grossTotal.toFixed(2));

  let finalDiscount = discountAmount;
  if (discountPercent > 0 && !discountAmount) {
    finalDiscount = parseFloat(((grossTotal * discountPercent) / 100).toFixed(2));
  }
  const taxableAmount = Math.max(0, parseFloat((grossTotal - finalDiscount).toFixed(2)));

  let cgstAmount = 0,
    sgstAmount = 0,
    igstAmount = 0;
  if (taxType === 'cgst_sgst') {
    cgstAmount = parseFloat(((taxableAmount * 9) / 100).toFixed(2));
    sgstAmount = parseFloat(((taxableAmount * 9) / 100).toFixed(2));
  } else if (taxType === 'igst') {
    igstAmount = parseFloat(((taxableAmount * 18) / 100).toFixed(2));
  }

  const rawTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount;
  const netTotal = Math.round(rawTotal);
  const roundOff = parseFloat((netTotal - rawTotal).toFixed(2));
  const amountInWords = numberToWordsIndian(netTotal);

  // Save Quotation Handler
  const handleSaveQuotation = async () => {
    setError(null);
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (!customerPhone.trim()) {
      setError('Customer phone number is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_gstin: customerGstin,
        delivery_address: deliveryAddress,
        site_location: siteLocation,
        project_name: projectName,
        quotation_date: quotationDate,
        tax_type: taxType,
        special_notes: specialNotes,
        discount_percent: discountPercent,
        discount_amount: finalDiscount,
        version: quotationId ? version : 1,
        areas: areas.map((a, i) => ({
          area_name: a.name,
          display_order: i + 1,
          items: a.items.map((it) => ({
            description: it.description,
            brand: it.brand,
            size: it.size,
            coverage_area: parseFloat(String(it.coverage_area)) || 0,
            quantity_sqft: parseFloat(String(it.quantity_sqft)) || 0,
            rate_per_sqft: parseFloat(String(it.rate_per_sqft)) || 0,
            quantity_boxes: parseFloat(String(it.quantity_boxes)) || 0,
            rate_per_box: parseFloat(String(it.rate_per_box)) || 0,
            total_amount: parseFloat(String(it.total_amount)) || 0,
          })),
        })),
      };

      if (quotationId) {
        const res = await fetchApi(`/api/quotations/${quotationId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onSaved(res.quotation.id);
      } else {
        const res = await fetchApi('/api/quotations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onSaved(res.quotation.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPdf = () => {
    if (!quotationId) return;
    const url = getPdfUrl(quotationId);
    setPreviewPdf({
      url,
      title: `Quotation ${quotationNumber} — ${customerName}`,
      fileName: `Quotation_${quotationNumber}.pdf`,
    });
  };

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  };

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto max-w-7xl">
      {/* Top Action Header */}
      <div className="card p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="btn btn-secondary btn-sm p-1.5"
            title="Back to List"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              {quotationId ? `Edit Quotation (${quotationNumber})` : 'New Quotation Builder'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Architectural Surfaces, Slabs & Tile Estimation
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {quotationId && (
            <button
              onClick={handleOpenPdf}
              className="btn btn-secondary btn-sm"
              title="Preview and Print PDF"
            >
              <Printer size={13} />
              <span>Preview PDF</span>
            </button>
          )}

          <button
            onClick={handleSaveQuotation}
            disabled={saving}
            className="btn btn-primary btn-sm"
          >
            <Save size={13} />
            <span>{saving ? 'Saving Record...' : 'Save Quotation'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs flex items-center space-x-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Customer & Quotation Info */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
          <UserCheck size={14} className="text-slate-700" />
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Customer Profile & Site Details
          </h2>
        </div>

        <div className="grid grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Select Existing Customer</label>
            <select className="input input-sm" onChange={handleSelectCustomer} defaultValue="">
              <option value="">-- Choose Existing Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Customer Name *</label>
            <input
              type="text"
              className="input input-sm"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Mr Vinayak"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Contact Number *</label>
            <input
              type="text"
              className="input input-sm font-mono"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 7795495467"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Quotation Date</label>
            <input
              type="date"
              className="input input-sm"
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Project / Villa Name</label>
            <input
              type="text"
              className="input input-sm"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Vinayak Villa Residence"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Customer GSTIN (Optional)</label>
            <input
              type="text"
              className="input input-sm font-mono"
              value={customerGstin}
              onChange={(e) => setCustomerGstin(e.target.value)}
              placeholder="e.g. 29ABCDE1234F1Z5"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-slate-600 font-medium mb-1">Site Delivery Address</label>
            <input
              type="text"
              className="input input-sm"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="e.g. Villa 42, Palm Meadows, Whitefield, Bengaluru"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Room / Areas & Tile Line Items */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Room-Wise Tile Specifications
            </h2>
            <p className="text-[11px] text-slate-500">
              Calculate quantities across square feet and full packaging boxes
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddArea}
            className="btn btn-secondary btn-sm"
          >
            <Plus size={13} />
            <span>Add Area / Room</span>
          </button>
        </div>

        {areas.map((area, areaIdx) => (
          <div key={areaIdx} className="card overflow-hidden">
            {/* Area Header Bar */}
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  AREA #{areaIdx + 1}:
                </span>
                <input
                  type="text"
                  className="input input-sm w-64 font-bold text-slate-900 uppercase tracking-wide bg-white"
                  value={area.name}
                  onChange={(e) => {
                    const newAreas = [...areas];
                    newAreas[areaIdx].name = e.target.value;
                    setAreas(newAreas);
                  }}
                  placeholder="e.g. MASTER BEDROOM, BALCONY"
                />
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleAddItem(areaIdx)}
                  className="btn btn-secondary btn-xs"
                >
                  <Plus size={12} />
                  <span>Add Line Item</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveArea(areaIdx)}
                  className="btn btn-secondary btn-xs text-rose-600 hover:text-rose-700"
                  title="Remove this room"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Area Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold text-[11px]">
                    <th className="py-2 px-2 text-center w-8">Sl</th>
                    <th className="py-2 px-2 w-64">Tile Description</th>
                    <th className="py-2 px-2 w-36">Brand</th>
                    <th className="py-2 px-2 w-32">Size</th>
                    <th className="py-2 px-2 text-right w-20">Cov/Box</th>
                    <th className="py-2 px-2 text-right w-24">Sqft</th>
                    <th className="py-2 px-2 text-right w-24">Rate/Sqft</th>
                    <th className="py-2 px-2 text-right w-20">Boxes</th>
                    <th className="py-2 px-2 text-right w-24">Rate/Box</th>
                    <th className="py-2 px-2 text-right w-28">Total (₹)</th>
                    <th className="py-2 px-2 text-center w-10">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {area.items.map((item, itemIdx) => (
                    <tr key={itemIdx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-1.5 px-2 text-center font-mono text-slate-400">
                        {item.sl_no}
                      </td>

                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          className="input input-sm py-1 font-medium text-slate-900"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(areaIdx, itemIdx, 'description', e.target.value)
                          }
                          placeholder="Surface / Tile description"
                        />
                      </td>

                      <td className="py-1.5 px-2">
                        <select
                          className="input input-sm py-1"
                          value={item.brand}
                          onChange={(e) =>
                            handleItemChange(areaIdx, itemIdx, 'brand', e.target.value)
                          }
                        >
                          {brands.length > 0 ? (
                            brands.map((b) => (
                              <option key={b.id} value={b.name}>
                                {b.name}
                              </option>
                            ))
                          ) : (
                            <option value="Simpolo Ceramics">Simpolo Ceramics</option>
                          )}
                        </select>
                      </td>

                      <td className="py-1.5 px-2">
                        <select
                          className="input input-sm py-1 font-mono"
                          value={item.size}
                          onChange={(e) =>
                            handleItemChange(areaIdx, itemIdx, 'size', e.target.value)
                          }
                        >
                          {coverages.length > 0 ? (
                            coverages.map((c) => (
                              <option key={c.id} value={c.size}>
                                {c.size} ({c.coverage_sqft} sqft)
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="1200X1800">1200X1800</option>
                              <option value="1200X2400">1200X2400</option>
                              <option value="800X1600">800X1600</option>
                              <option value="600X1200">600X1200</option>
                            </>
                          )}
                        </select>
                      </td>

                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          step="0.1"
                          className="input input-sm py-1 text-right text-slate-600 font-mono"
                          value={item.coverage_area}
                          onChange={(e) =>
                            handleItemChange(areaIdx, itemIdx, 'coverage_area', e.target.value)
                          }
                        />
                      </td>

                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          step="1"
                          className="input input-sm py-1 text-right font-semibold text-slate-900 tabular-nums"
                          value={item.quantity_sqft}
                          onChange={(e) =>
                            handleItemChange(areaIdx, itemIdx, 'quantity_sqft', e.target.value)
                          }
                        />
                      </td>

                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          step="0.01"
                          className="input input-sm py-1 text-right text-slate-700 tabular-nums"
                          value={item.rate_per_sqft}
                          onChange={(e) =>
                            handleItemChange(areaIdx, itemIdx, 'rate_per_sqft', e.target.value)
                          }
                        />
                      </td>

                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          step="0.01"
                          className="input input-sm py-1 text-right text-slate-600 tabular-nums"
                          value={item.quantity_boxes}
                          onChange={(e) =>
                            handleItemChange(areaIdx, itemIdx, 'quantity_boxes', e.target.value)
                          }
                        />
                      </td>

                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          step="0.01"
                          className="input input-sm py-1 text-right text-slate-700 tabular-nums"
                          value={item.rate_per_box}
                          onChange={(e) =>
                            handleItemChange(areaIdx, itemIdx, 'rate_per_box', e.target.value)
                          }
                        />
                      </td>

                      <td className="py-1.5 px-2 text-right font-bold text-slate-900 tabular-nums">
                        ₹ {formatCurrency(item.total_amount)}
                      </td>

                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(areaIdx, itemIdx)}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete line"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Section 3: Summary, GST, Discount & Notes */}
      <div className="grid grid-cols-2 gap-5 card p-4">
        {/* Left Side: Special Notes & Tax Options */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">GST Tax Framework</label>
            <select
              className="input input-sm w-72"
              value={taxType}
              onChange={(e) => setTaxType(e.target.value as any)}
            >
              <option value="cgst_sgst">Intra-State: CGST (9%) + SGST (9%) = 18%</option>
              <option value="igst">Inter-State: IGST (18%)</option>
              <option value="exempt">Inclusive of Taxes / Exempt (0%)</option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              For Karnataka billing: Intra-State. For other states dispatch: Inter-State.
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Special Notes & Instructions
            </label>
            <textarea
              className="input text-xs"
              rows={3}
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="e.g. Batch shade matching guaranteed. Site unloading by customer."
            />
          </div>

          {/* Amount in words live box */}
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Amount In Words (Indian Numbering Format):
            </span>
            <span className="text-xs font-semibold text-slate-900 italic mt-0.5 block">
              {amountInWords}
            </span>
          </div>
        </div>

        {/* Right Side: Totals Card */}
        <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between py-1">
            <span className="text-slate-600 font-medium">Gross Product Total:</span>
            <span className="font-bold text-slate-900 tabular-nums">
              ₹ {formatCurrency(grossTotal)}
            </span>
          </div>

          {/* Discount Input */}
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-600 font-medium">Trade Discount (INR):</span>
            <input
              type="number"
              step="0.01"
              className="input input-sm w-36 text-right tabular-nums font-semibold"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>

          <div className="flex justify-between py-1 border-t border-slate-200 pt-2">
            <span className="text-slate-600 font-medium">Taxable Base Amount:</span>
            <span className="font-bold text-slate-900 tabular-nums">
              ₹ {formatCurrency(taxableAmount)}
            </span>
          </div>

          {taxType === 'cgst_sgst' && (
            <>
              <div className="flex justify-between py-1 text-slate-600">
                <span>CGST (9%):</span>
                <span className="tabular-nums">₹ {formatCurrency(cgstAmount)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>SGST (9%):</span>
                <span className="tabular-nums">₹ {formatCurrency(sgstAmount)}</span>
              </div>
            </>
          )}

          {taxType === 'igst' && (
            <div className="flex justify-between py-1 text-slate-600">
              <span>IGST (18%):</span>
              <span className="tabular-nums">₹ {formatCurrency(igstAmount)}</span>
            </div>
          )}

          <div className="flex justify-between py-1 text-slate-600">
            <span>Round Off:</span>
            <span className="tabular-nums">₹ {formatCurrency(roundOff)}</span>
          </div>

          {/* Net Total Highlight */}
          <div className="flex justify-between items-center p-3 bg-slate-900 text-white rounded-md mt-2 shadow-sm">
            <div>
              <span className="font-bold text-xs uppercase tracking-wider block text-slate-300">
                Net Payable Total
              </span>
              <span className="text-[10px] text-slate-400">Inclusive of GST</span>
            </div>
            <span className="font-bold text-lg tabular-nums">
              ₹ {formatCurrency(netTotal)}
            </span>
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
        />
      )}
    </div>
  );
};
