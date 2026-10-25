import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Vite ?url import bundles worker offline without requiring external internet CDN
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  X,
  Upload,
  FileText,
  ChevronLeft,
  ChevronRight,
  Camera,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  RefreshCw,
  Search,
  Eye,
  FileSpreadsheet,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useServer } from '../context/ServerContext';
import { SanitaryCatalogItem } from '../types';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

interface StagedItem {
  id: string;
  item_code: string;
  brand: string;
  category: string;
  item_description: string;
  mrp_price: number;
  item_image?: string;
  page_number?: number;
}

export const SanitaryPdfCatalogUploaderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const { fetchApi } = useServer();

  const [activeTab, setActiveTab] = useState<'pdf' | 'excel'>('pdf');

  // PDF State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [renderingPage, setRenderingPage] = useState<boolean>(false);
  const [defaultBrand, setDefaultBrand] = useState<string>('Cera');
  const [catalogName, setCatalogName] = useState<string>('');

  // Staged Items extracted from PDF or Excel
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isScanningPage, setIsScanningPage] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual Add Form State in Modal
  const [manualCode, setManualCode] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualMrp, setManualMrp] = useState('');
  const [manualCategory, setManualCategory] = useState('Water Closet');
  const [manualImage, setManualImage] = useState('');

  // Visual Crop / Capture State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [cropMode, setCropMode] = useState<boolean>(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Excel State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelParsing, setExcelParsing] = useState(false);

  const categories = [
    'Water Closet',
    'Wash Basin',
    'Urinal',
    'Faucet',
    'Shower',
    'Diverter',
    'Bath Accessories',
    'Kitchen Sink',
    'General',
  ];

  // 1. Handle PDF Selection
  const handleSelectPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setImportSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }

    setPdfFile(file);
    setCatalogName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const loadedPdf = await loadingTask.promise;
      setPdfDoc(loadedPdf);
      setNumPages(loadedPdf.numPages);
      setCurrentPage(1);
    } catch (err: any) {
      setError('Failed to load PDF document: ' + err.message);
    }
  };

  // 2. Render Page to Canvas
  const renderPage = async (pageNum: number) => {
    if (!pdfDoc) return;
    setRenderingPage(true);
    setCropRect(null);

    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const viewport = page.getViewport({ scale: 1.5 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      await page.render(renderContext).promise;
    } catch (err: any) {
      console.error('Page render error:', err);
    } finally {
      setRenderingPage(false);
    }
  };

  useEffect(() => {
    if (pdfDoc && currentPage) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage]);

  // 3. Scan Current Page for Item Codes, Descriptions & MRP Prices
  const handleAutoScanPage = async () => {
    if (!pdfDoc) return;
    setIsScanningPage(true);
    setError(null);

    try {
      const page = await pdfDoc.getPage(currentPage);
      const textContent = await page.getTextContent();
      const strings = textContent.items
        .map((it: any) => it.str?.trim())
        .filter((s: string) => Boolean(s));

      console.log('Extracted text strings from page:', strings);

      // Heuristic parsing for sanitary items:
      // Item codes: alphanumeric combinations with letters, digits, dashes or slashes
      // MRP: currency numbers (e.g. 14,500, ₹12490, 8900.00)
      const foundItems: StagedItem[] = [];

      // Regex patterns
      const codeRegex = /\b([A-Z]{1,5}[-_]?[0-9]{2,6}[A-Z0-9\-_]*|[0-9]{4,8}[A-Z0-9\-_]*)\b/i;
      const priceRegex = /(?:₹|Rs\.?|MRP[:\s]*)?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|\b[1-9][0-9]{3,5}(?:\.[0-9]{2})?\b)/i;

      // Group neighboring strings
      for (let i = 0; i < strings.length; i++) {
        const str = strings[i];
        const codeMatch = str.match(codeRegex);

        if (codeMatch && codeMatch[1].length >= 3 && !codeMatch[1].toLowerCase().includes('page')) {
          const code = codeMatch[1].toUpperCase();

          // Search neighboring strings for price and description
          let mrp = 0;
          let desc = '';
          const windowSize = 8;
          const start = Math.max(0, i - windowSize);
          const end = Math.min(strings.length, i + windowSize);

          for (let j = start; j < end; j++) {
            if (j === i) continue;
            const neighbor = strings[j];

            // Look for price
            if (!mrp) {
              const pMatch = neighbor.match(priceRegex);
              if (pMatch && pMatch[1]) {
                const cleanP = parseFloat(pMatch[1].replace(/,/g, ''));
                if (cleanP >= 100 && cleanP <= 500000) {
                  mrp = cleanP;
                }
              }
            }

            // Look for description (longer text string with words)
            if (!desc && neighbor.length >= 8 && /[a-zA-Z]{3,}/.test(neighbor) && !neighbor.match(codeRegex)) {
              desc = neighbor;
            }
          }

          // Guess category from description
          let cat = 'Water Closet';
          const lowerDesc = (desc + ' ' + str).toLowerCase();
          if (lowerDesc.includes('basin') || lowerDesc.includes('sink')) cat = 'Wash Basin';
          else if (lowerDesc.includes('closet') || lowerDesc.includes('ewc') || lowerDesc.includes('toilet') || lowerDesc.includes('commode')) cat = 'Water Closet';
          else if (lowerDesc.includes('urinal')) cat = 'Urinal';
          else if (lowerDesc.includes('faucet') || lowerDesc.includes('tap') || lowerDesc.includes('mixer')) cat = 'Faucet';
          else if (lowerDesc.includes('shower')) cat = 'Shower';
          else if (lowerDesc.includes('diverter')) cat = 'Diverter';

          // Snapshot a clean thumbnail from the current page canvas
          let pageSnapshot = '';
          if (canvasRef.current) {
            try {
              // Create scaled thumbnail of the page
              const thumbCanvas = document.createElement('canvas');
              thumbCanvas.width = 160;
              thumbCanvas.height = 160;
              const tCtx = thumbCanvas.getContext('2d');
              if (tCtx) {
                tCtx.drawImage(canvasRef.current, 0, 0, thumbCanvas.width, thumbCanvas.height);
                pageSnapshot = thumbCanvas.toDataURL('image/jpeg', 0.75);
              }
            } catch (e) {
              console.warn('Canvas snapshot error:', e);
            }
          }

          // Check if not already added
          if (!stagedItems.some((it) => it.item_code.toUpperCase() === code) && !foundItems.some((it) => it.item_code === code)) {
            foundItems.push({
              id: Math.random().toString(36).substring(2, 9),
              item_code: code,
              brand: defaultBrand || 'Sanitary',
              category: cat,
              item_description: desc || `${defaultBrand} Sanitary Item ${code}`,
              mrp_price: mrp || 0,
              item_image: pageSnapshot,
              page_number: currentPage,
            });
          }
        }
      }

      if (foundItems.length > 0) {
        setStagedItems((prev) => [...prev, ...foundItems]);
      } else {
        // If automatic regex didn't find codes, auto-generate a staged entry for current page so user can type the code easily
        setStagedItems((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            item_code: `SN-${defaultBrand.substring(0, 3).toUpperCase()}-P${currentPage}`,
            brand: defaultBrand || 'Sanitary',
            category: 'Water Closet',
            item_description: strings.slice(0, 4).join(' ') || `${defaultBrand} Sanitary Ware Item`,
            mrp_price: 0,
            item_image: canvasRef.current?.toDataURL('image/jpeg', 0.7) || '',
            page_number: currentPage,
          },
        ]);
      }
    } catch (err: any) {
      setError('Scan error: ' + err.message);
    } finally {
      setIsScanningPage(false);
    }
  };

  // 4. Capture Custom Crop Region from Canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setCropStart({ x, y });
    setCropRect({ x, y, w: 0, h: 0 });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropMode || !cropStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const curX = (e.clientX - rect.left) * scaleX;
    const curY = (e.clientY - rect.top) * scaleY;

    const x = Math.min(cropStart.x, curX);
    const y = Math.min(cropStart.y, curY);
    const w = Math.abs(curX - cropStart.x);
    const h = Math.abs(curY - cropStart.y);

    setCropRect({ x, y, w, h });
  };

  const handleCanvasMouseUp = () => {
    if (!cropMode || !cropRect || cropRect.w < 10 || cropRect.h < 10) {
      setCropStart(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Crop the selected region to a dedicated canvas
    try {
      const cropCanvas = document.createElement('canvas');
      const maxDim = 280;
      const ratio = Math.min(maxDim / cropRect.w, maxDim / cropRect.h, 1);
      cropCanvas.width = Math.round(cropRect.w * ratio);
      cropCanvas.height = Math.round(cropRect.h * ratio);

      const ctx = cropCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          canvas,
          cropRect.x,
          cropRect.y,
          cropRect.w,
          cropRect.h,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height
        );
        const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.85);

        // Assign to the latest staged item or manual form
        if (stagedItems.length > 0) {
          setStagedItems((prev) => {
            const copy = [...prev];
            copy[copy.length - 1].item_image = dataUrl;
            return copy;
          });
        } else {
          setManualImage(dataUrl);
        }
      }
    } catch (err) {
      console.error('Crop error:', err);
    }

    setCropStart(null);
    setCropMode(false);
  };

  // 5. Add Manual Item to Staged List
  const handleAddManualItem = () => {
    if (!manualCode.trim()) {
      setError('Please provide an Item Code.');
      return;
    }

    const newItem: StagedItem = {
      id: Math.random().toString(36).substring(2, 9),
      item_code: manualCode.trim().toUpperCase(),
      brand: defaultBrand || 'Sanitary',
      category: manualCategory,
      item_description: manualDesc.trim() || `${defaultBrand} ${manualCode.trim()}`,
      mrp_price: parseFloat(manualMrp) || 0,
      item_image: manualImage || canvasRef.current?.toDataURL('image/jpeg', 0.7) || '',
      page_number: currentPage,
    };

    setStagedItems((prev) => [newItem, ...prev]);
    setManualCode('');
    setManualDesc('');
    setManualMrp('');
    setManualImage('');
    setError(null);
  };

  // 6. Delete Staged Item
  const handleDeleteStaged = (id: string) => {
    setStagedItems((prev) => prev.filter((it) => it.id !== id));
  };

  // 7. Update Staged Item Field
  const handleUpdateStaged = (id: string, field: keyof StagedItem, value: any) => {
    setStagedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  // 8. Excel Import Handler
  const handleSelectExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setCatalogName(file.name);
    setExcelParsing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        // Simple universal CSV/TSV parser
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          setError('Spreadsheet appears to be empty.');
          setExcelParsing(false);
          return;
        }

        const headerLine = lines[0].toLowerCase();
        const headers = headerLine.split(/,|\t/).map((h) => h.trim().replace(/^"|"$/g, ''));

        const codeIdx = headers.findIndex((h) => h.includes('code') || h.includes('sku') || h.includes('item'));
        const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('name') || h.includes('title'));
        const mrpIdx = headers.findIndex((h) => h.includes('mrp') || h.includes('price') || h.includes('rate'));
        const brandIdx = headers.findIndex((h) => h.includes('brand'));
        const catIdx = headers.findIndex((h) => h.includes('cat') || h.includes('type'));
        const imgIdx = headers.findIndex((h) => h.includes('img') || h.includes('image') || h.includes('photo'));

        const parsedItems: StagedItem[] = [];

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(/,|\t/).map((c) => c.trim().replace(/^"|"$/g, ''));
          const code = codeIdx >= 0 && row[codeIdx] ? row[codeIdx] : `ITEM-${i}`;
          if (!code) continue;

          const desc = descIdx >= 0 && row[descIdx] ? row[descIdx] : code;
          const rawMrp = mrpIdx >= 0 && row[mrpIdx] ? row[mrpIdx].replace(/[^\d.]/g, '') : '0';
          const b = brandIdx >= 0 && row[brandIdx] ? row[brandIdx] : defaultBrand;
          const c = catIdx >= 0 && row[catIdx] ? row[catIdx] : 'General';
          const img = imgIdx >= 0 && row[imgIdx] ? row[imgIdx] : '';

          parsedItems.push({
            id: Math.random().toString(36).substring(2, 9),
            item_code: code.toUpperCase(),
            brand: b || 'Sanitary',
            category: c || 'General',
            item_description: desc,
            mrp_price: parseFloat(rawMrp) || 0,
            item_image: img || '',
            page_number: i,
          });
        }

        setStagedItems((prev) => [...prev, ...parsedItems]);
        setImportSuccess(`Successfully parsed ${parsedItems.length} items from ${file.name}!`);
      } catch (err: any) {
        setError('Failed to parse spreadsheet: ' + err.message);
      } finally {
        setExcelParsing(false);
      }
    };
    reader.readAsText(file);
  };

  // 9. Save All Staged Items to Database
  const handleSaveToCatalog = async () => {
    if (stagedItems.length === 0) {
      setError('No items to import. Please scan pages or add items.');
      return;
    }

    setIsImporting(true);
    setError(null);
    setImportSuccess(null);

    try {
      const payload = {
        catalog_name: catalogName || `${defaultBrand} Sanitary Catalogue`,
        items: stagedItems.map((it) => ({
          item_code: it.item_code.trim(),
          brand: it.brand.trim() || defaultBrand || 'Sanitary',
          category: it.category.trim() || 'General',
          item_description: it.item_description.trim(),
          mrp_price: it.mrp_price || 0,
          item_image: it.item_image || null,
          catalog_name: catalogName || `${defaultBrand} Sanitary Catalogue`,
          page_number: it.page_number || 1,
        })),
      };

      const res = await fetchApi<any>('/api/sanitary-catalog/batch', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setImportSuccess(`Success! ${res.count || stagedItems.length} items imported into Sanitary Catalog.`);
      setStagedItems([]);
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save items to catalog');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-6xl h-[92vh] flex flex-col bg-[#0D1B2A]/95 text-[#E0E1DD] border border-white/20 rounded-2xl shadow-2xl overflow-hidden glass-panel">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#09131F]/80">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center space-x-2">
                <span>Sanitary Catalogue Upload & Reference Extractor</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 font-mono">
                  Auto-Fetch Engine
                </span>
              </h2>
              <p className="text-xs text-[#778DA9]">
                Upload PDF manufacturer price lists or spreadsheets to auto-populate Description, Image & MRP when entering Item Codes
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Import Mode Tabs */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('pdf')}
                className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-all ${
                  activeTab === 'pdf' ? 'bg-teal-600 text-white shadow-xs' : 'text-[#778DA9] hover:text-white'
                }`}
              >
                <FileText size={13} />
                <span>PDF Catalogue</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('excel')}
                className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-all ${
                  activeTab === 'excel' ? 'bg-teal-600 text-white shadow-xs' : 'text-[#778DA9] hover:text-white'
                }`}
              >
                <FileSpreadsheet size={13} />
                <span>Excel / CSV</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#778DA9] hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status / Alerts */}
        {error && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs flex items-center space-x-2 shrink-0">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {importSuccess && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs flex items-center space-x-2 shrink-0">
            <Check size={15} className="shrink-0" />
            <span>{importSuccess}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          {/* Left Column: PDF Viewer / Visual Extractor Canvas */}
          {activeTab === 'pdf' ? (
            <div className="w-1/2 flex flex-col bg-black/40 border border-white/10 rounded-xl overflow-hidden">
              {/* PDF Controls Header */}
              <div className="p-3 border-b border-white/10 bg-[#09131F]/90 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className="btn btn-xs bg-teal-600 hover:bg-teal-500 text-white flex items-center space-x-1 font-semibold"
                  >
                    <Upload size={12} />
                    <span>{pdfFile ? 'Change PDF' : 'Select PDF File'}</span>
                  </button>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleSelectPdf}
                  />

                  {pdfFile && (
                    <span className="text-[11px] text-[#E0E1DD] font-mono truncate max-w-[140px]" title={pdfFile.name}>
                      {pdfFile.name}
                    </span>
                  )}
                </div>

                {numPages > 0 && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1 || renderingPage}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[11px] font-mono font-semibold px-1">
                      {currentPage} / {numPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= numPages || renderingPage}
                      onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Action Toolbar above Canvas */}
              {pdfDoc && (
                <div className="px-3 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <label className="text-[11px] text-[#778DA9]">Brand:</label>
                    <input
                      type="text"
                      className="input input-xs w-24 bg-white/10 border-white/20 text-white text-xs font-semibold"
                      value={defaultBrand}
                      onChange={(e) => setDefaultBrand(e.target.value)}
                      placeholder="e.g. Cera"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleAutoScanPage}
                      disabled={isScanningPage}
                      className="btn btn-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-1 font-semibold"
                      title="Scan current page text for codes and prices"
                    >
                      <Sparkles size={12} className={isScanningPage ? 'animate-spin' : ''} />
                      <span>{isScanningPage ? 'Scanning...' : 'Auto-Scan Page'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCropMode((prev) => !prev)}
                      className={`btn btn-xs flex items-center space-x-1 font-semibold ${
                        cropMode
                          ? 'bg-amber-500 text-slate-900 shadow-sm'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                      title="Drag to crop product photo directly from page"
                    >
                      <Camera size={12} />
                      <span>{cropMode ? 'Cancel Crop' : 'Crop Photo'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Canvas Container */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-3 relative bg-slate-900/60">
                {renderingPage && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
                    <RefreshCw className="animate-spin text-teal-400" size={24} />
                  </div>
                )}

                {pdfDoc ? (
                  <div className="relative border border-white/15 rounded shadow-lg overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      className={`max-w-full h-auto cursor-${cropMode ? 'crosshair' : 'default'}`}
                    />
                    {/* Visual Crop Selection Box */}
                    {cropMode && cropRect && (
                      <div
                        className="absolute border-2 border-amber-400 bg-amber-400/25 pointer-events-none"
                        style={{
                          left: `${cropRect.x}px`,
                          top: `${cropRect.y}px`,
                          width: `${cropRect.w}px`,
                          height: `${cropRect.h}px`,
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="text-center p-8 text-[#778DA9]">
                    <Upload size={36} className="mx-auto mb-2 opacity-40 text-teal-400" />
                    <p className="text-xs font-semibold text-white">No PDF Catalogue Loaded</p>
                    <p className="text-[11px] mt-1 max-w-xs">
                      Click "Select PDF File" above to load manufacturer catalogue (Cera, Jaquar, Kohler, Hindware, etc.)
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Excel / CSV Import Section */
            <div className="w-1/2 flex flex-col bg-black/40 border border-white/10 rounded-xl p-5 overflow-y-auto space-y-4">
              <div className="text-center p-6 border-2 border-dashed border-white/20 rounded-xl hover:border-teal-400/60 transition-colors">
                <FileSpreadsheet size={36} className="mx-auto mb-2 text-teal-400 opacity-80" />
                <h3 className="text-sm font-bold text-white">Import Catalogue from CSV / Spreadsheet</h3>
                <p className="text-xs text-[#778DA9] mt-1 max-w-sm mx-auto">
                  Upload an Excel (.csv or .tsv) price list with columns: <code>Item Code</code>, <code>Description</code>, <code>MRP</code>, <code>Brand</code>, <code>Category</code>
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => excelInputRef.current?.click()}
                    className="btn btn-sm bg-teal-600 hover:bg-teal-500 text-white font-semibold inline-flex items-center space-x-1.5"
                  >
                    <Upload size={14} />
                    <span>Select Spreadsheet (.csv / .tsv)</span>
                  </button>
                  <input
                    ref={excelInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={handleSelectExcel}
                  />
                </div>
              </div>

              {excelFile && (
                <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet size={16} className="text-emerald-400" />
                    <span className="font-semibold text-white">{excelFile.name}</span>
                  </div>
                  <span className="text-[#778DA9] font-mono">{(excelFile.size / 1024).toFixed(1)} KB</span>
                </div>
              )}

              {/* Sample Structure Guide */}
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs space-y-1.5 text-[#778DA9]">
                <span className="font-semibold text-white block">Expected CSV Format:</span>
                <code className="block p-2 rounded bg-black/50 text-[11px] text-teal-300 font-mono">
                  Item Code, Description, MRP, Brand, Category<br />
                  SN-WC-101, Wall Hung Rimless Water Closet, 14500, Cera, Water Closet<br />
                  SN-WB-301, Table Top Oval Ceramic Basin, 6800, Cera, Wash Basin
                </code>
              </div>
            </div>
          )}

          {/* Right Column: Staged Line Items List & Quick Add Form */}
          <div className="w-1/2 flex flex-col bg-black/40 border border-white/10 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-white/10 bg-[#09131F]/90 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Layers size={15} className="text-teal-400" />
                <span className="text-xs font-bold text-white tracking-wide">
                  Staged Reference Items ({stagedItems.length})
                </span>
              </div>

              {stagedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStagedItems([])}
                  className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Quick Add Form */}
            <div className="p-3 bg-white/5 border-b border-white/10 shrink-0 space-y-2">
              <div className="text-[11px] font-semibold text-[#778DA9] uppercase tracking-wider flex items-center justify-between">
                <span>Quick Add Item</span>
                {manualImage && (
                  <span className="text-[10px] text-emerald-400 font-medium">✓ Photo Cropped</span>
                )}
              </div>
              <div className="grid grid-cols-12 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Item Code *"
                  className="col-span-3 input input-xs bg-white/10 border-white/20 text-white font-mono uppercase font-bold"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Description *"
                  className="col-span-4 input input-xs bg-white/10 border-white/20 text-white"
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="MRP (₹)"
                  className="col-span-2 input input-xs bg-white/10 border-white/20 text-white font-mono"
                  value={manualMrp}
                  onChange={(e) => setManualMrp(e.target.value)}
                />
                <select
                  className="col-span-2 select select-xs bg-[#0D1B2A] border-white/20 text-white text-[10px]"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="col-span-1 btn btn-xs bg-teal-600 hover:bg-teal-500 text-white font-bold p-0 flex items-center justify-center"
                  title="Add to Staged Items"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Staged Items List Table */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/10">
              {stagedItems.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-8 text-[#778DA9]">
                  <div>
                    <Sparkles size={28} className="mx-auto mb-2 opacity-30 text-teal-300" />
                    <p className="text-xs font-semibold text-white">No items staged yet</p>
                    <p className="text-[11px] mt-1 max-w-xs">
                      Click <strong>"Auto-Scan Page"</strong> on the left, crop a photo, or use the Quick Add form to build the catalog list.
                    </p>
                  </div>
                </div>
              ) : (
                stagedItems.map((it, idx) => (
                  <div
                    key={it.id}
                    className="p-2.5 flex items-center justify-between hover:bg-white/5 transition-colors gap-2 text-xs"
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/15 overflow-hidden shrink-0 flex items-center justify-center">
                      {it.item_image ? (
                        <img
                          src={it.item_image}
                          alt={it.item_code}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera size={14} className="text-[#778DA9] opacity-40" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          value={it.item_code}
                          onChange={(e) => handleUpdateStaged(it.id, 'item_code', e.target.value.toUpperCase())}
                          className="input input-xs w-28 bg-white/10 border-white/20 text-white font-mono font-bold uppercase text-[11px]"
                        />
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 font-mono border border-teal-400/20">
                          {it.category}
                        </span>
                        {it.page_number && (
                          <span className="text-[10px] text-[#778DA9] font-mono">
                            p.{it.page_number}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={it.item_description}
                        onChange={(e) => handleUpdateStaged(it.id, 'item_description', e.target.value)}
                        className="input input-xs w-full bg-white/5 border-transparent hover:border-white/20 text-white text-[11px]"
                        placeholder="Item Description"
                      />
                    </div>

                    {/* MRP & Delete */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[9px] text-[#778DA9] block">MRP (₹)</span>
                        <input
                          type="number"
                          value={it.mrp_price || ''}
                          onChange={(e) => handleUpdateStaged(it.id, 'mrp_price', parseFloat(e.target.value) || 0)}
                          className="input input-xs w-20 bg-white/10 border-white/20 text-right text-emerald-300 font-mono font-bold text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteStaged(it.id)}
                        className="p-1 rounded text-[#778DA9] hover:text-rose-400 hover:bg-white/10 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Footer for Right Column */}
            <div className="p-3 bg-[#09131F]/90 border-t border-white/10 flex items-center justify-between shrink-0">
              <span className="text-xs text-[#778DA9]">
                Ready to save: <strong className="text-white">{stagedItems.length}</strong> products
              </span>

              <button
                type="button"
                disabled={stagedItems.length === 0 || isImporting}
                onClick={handleSaveToCatalog}
                className="btn btn-sm bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold flex items-center space-x-1.5 shadow-md shadow-teal-900/40 disabled:opacity-50"
              >
                {isImporting ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}
                <span>{isImporting ? 'Importing...' : `Save ${stagedItems.length} Items to Catalog`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-[#09131F]/90 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-[#778DA9]">
            💡 Once imported, any salesperson typing these Item Codes in Sanitary Quotations will have Description, Image & MRP auto-filled instantly.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#778DA9] hover:text-white hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
