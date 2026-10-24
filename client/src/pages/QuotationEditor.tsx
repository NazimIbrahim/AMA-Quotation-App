import React, { useState, useEffect, useRef } from 'react';
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
  Search,
  Phone,
  MapPin,
  Sparkles,
  CheckCircle2,
  X,
  Loader2,
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
  const [customerId, setCustomerId] = useState<number | null>(null);
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

  // Customer Autocomplete & Live Lookup State
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activePopupSource, setActivePopupSource] = useState<'search' | 'phone' | 'name' | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [exactPhoneMatch, setExactPhoneMatch] = useState<Customer | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live customer lookup triggered as user types
  const triggerCustomerLookup = (queryText: string, source: 'search' | 'phone' | 'name') => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = queryText.trim();
    const cleanDigits = queryText.replace(/\D/g, '');

    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      setExactPhoneMatch(null);
      return;
    }

    // Fast local exact phone match check from cached customers
    if (source === 'phone' && cleanDigits.length >= 7) {
      const quick = customers.find((c) => {
        const cDigits = (c.mobile_number || '').replace(/\D/g, '');
        return cDigits === cleanDigits || (cleanDigits.length >= 10 && cDigits.endsWith(cleanDigits));
      });
      if (quick) {
        setExactPhoneMatch(quick);
      }
    }

    if (trimmed.length < 2) {
      setShowSuggestions(false);
      return;
    }

    setIsSearchingCustomer(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetchApi(`/api/customers/lookup?q=${encodeURIComponent(trimmed)}`);
        const found: Customer[] = res.customers || [];
        setSuggestions(found);
        setHighlightIndex(0);
        setShowSuggestions(found.length > 0);
        setActivePopupSource(source);

        if (source === 'phone' && cleanDigits.length >= 7) {
          const matched = found.find((c) => {
            const cDigits = (c.mobile_number || '').replace(/\D/g, '');
            return cDigits === cleanDigits || (cleanDigits.length >= 10 && cDigits.endsWith(cleanDigits));
          });
          setExactPhoneMatch(matched || null);
        }
      } catch (err) {
        console.error('Customer lookup error:', err);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 200);
  };

  // Auto-fill all customer details from database record
  const handleApplyCustomer = (selected: Customer) => {
    setCustomerId(selected.id);
    setCustomerName(selected.name);
    setCustomerPhone(selected.mobile_number);
    setCustomerGstin(selected.gstin || '');
    setDeliveryAddress(selected.delivery_address || '');
    setSiteLocation(selected.site_location || '');
    if (!projectName && (selected.site_location || selected.notes)) {
      setProjectName(selected.site_location || selected.notes || '');
    }
    setShowSuggestions(false);
    setActivePopupSource(null);
    setExactPhoneMatch(null);
    setCustomerSearchQuery('');
  };

  const handleUnlinkCustomer = () => {
    setCustomerId(null);
  };

  const handleKeyDownOnInput = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (suggestions[highlightIndex]) {
        e.preventDefault();
        handleApplyCustomer(suggestions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Reusable Auto-popup dropdown component
  const renderSuggestionsPopup = (source: 'search' | 'phone' | 'name') => {
    if (!showSuggestions || activePopupSource !== source || suggestions.length === 0) {
      return null;
    }

    return (
      <div
        ref={customerDropdownRef}
        className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-slate-300 rounded-lg shadow-2xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto w-full md:w-[420px] animate-in fade-in slide-in-from-top-1 duration-150"
      >
        <div className="bg-slate-50 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-500 font-semibold border-b border-slate-200">
          <div className="flex items-center space-x-1.5">
            <UserCheck size={12} className="text-slate-600" />
            <span>Customer Records Found ({suggestions.length})</span>
          </div>
          <span className="text-[10px] text-slate-400">Click or Enter to Auto-Fill</span>
        </div>

        {suggestions.map((c, idx) => {
          const isSelected = idx === highlightIndex;
          return (
            <div
              key={c.id}
              onClick={() => handleApplyCustomer(c)}
              onMouseEnter={() => setHighlightIndex(idx)}
              className={`p-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                isSelected ? 'bg-primary-50/80 text-primary-950' : 'hover:bg-slate-50'
              }`}
            >
              <div className="space-y-0.5 min-w-0 pr-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xs text-slate-900 truncate">{c.name}</span>
                  {c.gstin && (
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-mono rounded border border-slate-200">
                      GST: {c.gstin}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-600">
                  <span className="inline-flex items-center space-x-1 font-mono text-primary-700 font-semibold">
                    <Phone size={10} className="shrink-0" />
                    <span>{c.mobile_number}</span>
                  </span>
                  {(c.site_location || c.delivery_address) && (
                    <span className="inline-flex items-center space-x-1 text-slate-500 truncate max-w-[200px]">
                      <MapPin size={10} className="shrink-0" />
                      <span className="truncate">{c.site_location || c.delivery_address}</span>
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className={`btn btn-xs shrink-0 text-[10px] font-semibold px-2.5 py-1 ${
                  isSelected ? 'btn-primary' : 'btn-secondary'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleApplyCustomer(c);
                }}
              >
                Auto-fill All Details →
              </button>
            </div>
          );
        })}
      </div>
    );
  };

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
          setCustomerId(q.customer_id || null);
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
      handleApplyCustomer(selected);
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
        customer_id: customerId || null,
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

      {/* Section 1: Customer Profile & Auto-fill Details */}
      <div className="card p-4 space-y-4">
        {/* Header row with customer link status */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center space-x-2.5">
            <UserCheck size={16} className="text-slate-700" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Customer Profile & Site Details
            </h2>
            {customerId ? (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Linked to Customer #{customerId}</span>
                <button
                  type="button"
                  onClick={handleUnlinkCustomer}
                  className="hover:text-rose-600 ml-1 font-bold text-xs"
                  title="Unlink Customer (edit as custom)"
                >
                  <X size={11} />
                </button>
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 font-normal">
                (Type Phone or Name to search existing customer)
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Auto-popup on mobile number or customer name
          </div>
        </div>

        {/* Quick Customer Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {isSearchingCustomer ? (
                <Loader2 size={14} className="animate-spin text-primary-600" />
              ) : (
                <Search size={14} />
              )}
            </div>
            <input
              type="text"
              className="input input-sm pl-9 pr-8 w-full bg-white text-xs"
              placeholder="🔍 Quick Search: Type phone number, name, GSTIN, or site to auto-fill..."
              value={customerSearchQuery}
              onChange={(e) => {
                setCustomerSearchQuery(e.target.value);
                triggerCustomerLookup(e.target.value, 'search');
              }}
              onFocus={() => {
                if (customerSearchQuery.trim().length >= 2) {
                  triggerCustomerLookup(customerSearchQuery, 'search');
                }
              }}
              onKeyDown={handleKeyDownOnInput}
            />
            {customerSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setCustomerSearchQuery('');
                  setShowSuggestions(false);
                }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
            {renderSuggestionsPopup('search')}
          </div>

          {/* Quick Select from Loaded List */}
          <div className="shrink-0 flex items-center space-x-2">
            <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Or pick:</span>
            <select
              className="input input-sm text-xs max-w-[220px] bg-white"
              onChange={handleSelectCustomer}
              value={customerId || ''}
            >
              <option value="">-- Saved Customers List --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile_number})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Exact Phone Match Prompt Banner */}
        {exactPhoneMatch && customerId !== exactPhoneMatch.id && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 flex items-center justify-between text-xs text-emerald-950 shadow-sm animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center space-x-2.5">
              <Sparkles size={16} className="text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">Existing Customer Profile Found: </span>
                <span className="font-semibold text-emerald-900">{exactPhoneMatch.name}</span>
                <span className="font-mono text-emerald-700 ml-1.5 font-bold">({exactPhoneMatch.mobile_number})</span>
                {exactPhoneMatch.site_location && (
                  <span className="text-emerald-700 text-[11px] ml-2">• Site: {exactPhoneMatch.site_location}</span>
                )}
                {exactPhoneMatch.delivery_address && (
                  <span className="text-emerald-600 text-[11px] ml-2 hidden md:inline">• {exactPhoneMatch.delivery_address}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleApplyCustomer(exactPhoneMatch)}
              className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 shrink-0 rounded shadow"
            >
              Auto-fill All Details →
            </button>
          </div>
        )}

        {/* Customer Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Customer Name with popup */}
          <div className="relative">
            <label className="block text-slate-700 font-semibold mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              className="input input-sm w-full"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                triggerCustomerLookup(e.target.value, 'name');
              }}
              onFocus={() => {
                if (customerName.trim().length >= 2) {
                  triggerCustomerLookup(customerName, 'name');
                }
              }}
              onKeyDown={handleKeyDownOnInput}
              placeholder="e.g. Mr Vinayak"
              required
            />
            {renderSuggestionsPopup('name')}
          </div>

          {/* Contact Number with phone search popup */}
          <div className="relative">
            <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
              <span>Contact Number *</span>
              <span className="text-[10px] text-slate-400 font-normal">Search by number</span>
            </label>
            <div className="relative">
              <input
                type="text"
                className="input input-sm font-mono w-full"
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  triggerCustomerLookup(e.target.value, 'phone');
                }}
                onFocus={() => {
                  if (customerPhone.trim().length >= 2) {
                    triggerCustomerLookup(customerPhone, 'phone');
                  }
                }}
                onKeyDown={handleKeyDownOnInput}
                placeholder="e.g. 7795495467"
                required
              />
            </div>
            {renderSuggestionsPopup('phone')}
          </div>

          {/* Quotation Date */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Quotation Date</label>
            <input
              type="date"
              className="input input-sm w-full"
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
            />
          </div>

          {/* Project / Villa Name */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Project / Villa Name</label>
            <input
              type="text"
              className="input input-sm w-full"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Vinayak Villa Residence"
            />
          </div>

          {/* Customer GSTIN */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Customer GSTIN (Optional)</label>
            <input
              type="text"
              className="input input-sm font-mono w-full uppercase"
              value={customerGstin}
              onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
              placeholder="e.g. 29ABCDE1234F1Z5"
            />
          </div>

          {/* Site Location / City */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">Site Location / Area</label>
            <input
              type="text"
              className="input input-sm w-full"
              value={siteLocation}
              onChange={(e) => setSiteLocation(e.target.value)}
              placeholder="e.g. Whitefield, Bengaluru"
            />
          </div>

          {/* Site Delivery Address */}
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-slate-600 font-medium mb-1">Site Delivery Address</label>
            <input
              type="text"
              className="input input-sm w-full"
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
