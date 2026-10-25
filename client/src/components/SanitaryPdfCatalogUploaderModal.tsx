import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
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
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  } catch (e) {
    console.warn('Could not set PDF workerSrc:', e);
  }
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
  const renderTaskRef = useRef<any>(null);
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

      // Render first page with tiny delay to guarantee canvas DOM readiness
      setTimeout(() => {
        renderPage(1, loadedPdf);
      }, 50);
    } catch (err: any) {
      setError('Failed to load PDF document: ' + err.message);
    }
  };

  // 2. Render Page to Canvas
  const renderPage = async (pageNum: number, docOverride?: pdfjsLib.PDFDocumentProxy) => {
    const doc = docOverride || pdfDoc;
    if (!doc) return;

    // Cancel any previous in-progress page render
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (_) {}
      renderTaskRef.current = null;
    }

    setRenderingPage(true);
    setCropRect(null);

    try {
      const page = await doc.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) {
        setRenderingPage(false);
        return;
      }

      // Calculate scale to fit container width nicely (~540px)
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const desiredWidth = 540;
      const scale = Math.max(0.8, Math.min(2.0, desiredWidth / unscaledViewport.width));
      const viewport = page.getViewport({ scale });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setRenderingPage(false);
        return;
      }

      // Fill pure white background behind the page
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    } finally {
      setRenderingPage(false);
    }
  };

  useEffect(() => {
    if (pdfDoc && currentPage) {
      const timer = setTimeout(() => {
        renderPage(currentPage);
      }, 40);
      return () => clearTimeout(timer);
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
        .map((it: any) => (it as any).str?.trim())
        .filter((s: string) => Boolean(s));

      console.log('Extracted text strings from page:', strings);

      // Heuristic parsing for sanitary items:
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

          // Avoid duplicates in the current page scan
          if (foundItems.some((fi) => fi.item_code === code)) continue;

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

            // Look for description
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
              const thumbCanvas = document.createElement('canvas');
              thumbCanvas.width = 160;
              thumbCanvas.height = 160;
              const tCtx = thumbCanvas.getContext('2d');
              if (tCtx) {
                tCtx.fillStyle = '#FFFFFF';
                tCtx.fillRect(0, 0, 160, 160);
                tCtx.drawImage(canvasRef.current, 0, 0, thumbCanvas.width, thumbCanvas.height);
                pageSnapshot = thumbCanvas.toDataURL('image/jpeg', 0.75);
              }
            } catch (_) {}
          }

          foundItems.push({
            id: Math.random().toString(36).substring(2, 9),
            item_code: code,
            brand: defaultBrand || 'Sanitary',
            category: cat,
            item_description: desc || `${defaultBrand} Sanitary Item ${code}`,
            mrp_price: mrp,
            item_image: pageSnapshot,
            page_number: currentPage,
          });
        }
      }

      if (foundItems.length > 0) {
        setStagedItems((prev) => [...foundItems, ...prev]);
        setImportSuccess(`Auto-scanned page ${currentPage}: found ${foundItems.length} sanitary item(s)!`);
      } else {
        setError(`No recognized product codes found on page ${currentPage}. You can draw a box with "Crop Photo" or use Quick Add.`);
      }
    } catch (err: any) {
      setError('Page text extraction failed: ' + err.message);
    } finally {
      setIsScanningPage(false);
    }
  };

  // 4. Visual Canvas Cropping Handlers
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
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
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
          setImportSuccess('Cropped photo linked to item ' + stagedItems[stagedItems.length - 1].item_code);
        } else {
          setManualImage(dataUrl);
          setImportSuccess('Photo cropped! Enter Item Code & Description in the form to add it.');
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
      item_image: manualImage || (canvasRef.current ? canvasRef.current.toDataURL('image/jpeg', 0.7) : ''),
      page_number: currentPage,
    };

    setStagedItems((prev) => [newItem, ...prev]);
    setManualCode('');
    setManualDesc('');
    setManualMrp('');
    setManualImage('');
    setError(null);
    setImportSuccess(`Added ${newItem.item_code} to staged list.`);
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

        if (codeIdx === -1) {
          setError('Could not identify "Item Code" column in the header row.');
          setExcelParsing(false);
          return;
        }

        const parsed: StagedItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const rawRow = lines[i].split(/,|\t/).map((cell) => cell.trim().replace(/^"|"$/g, ''));
          const code = rawRow[codeIdx] || '';
          if (!code) continue;

          const desc = descIdx !== -1 ? rawRow[descIdx] : '';
          const mrpRaw = mrpIdx !== -1 ? rawRow[mrpIdx].replace(/[^0-9.]/g, '') : '0';
          const brand = brandIdx !== -1 ? rawRow[brandIdx] : defaultBrand || 'Sanitary';
          const cat = catIdx !== -1 ? rawRow[catIdx] : 'General';

          parsed.push({
            id: Math.random().toString(36).substring(2, 9),
            item_code: code.toUpperCase(),
            brand: brand || defaultBrand,
            category: cat || 'General',
            item_description: desc || `${brand} ${code}`,
            mrp_price: parseFloat(mrpRaw) || 0,
            item_image: '',
            page_number: 1,
          });
        }

        setStagedItems((prev) => [...parsed, ...prev]);
        setImportSuccess(`Imported ${parsed.length} items from ${file.name}!`);
      } catch (err: any) {
        setError('Failed to parse spreadsheet: ' + err.message);
      } finally {
        setExcelParsing(false);
      }
    };
    reader.readAsText(file);
  };

  // 9. Batch Save to Database
  const handleSaveToCatalog = async () => {
    if (stagedItems.length === 0) {
      setError('No staged items to save.');
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
    <div
      className="modal-overlay"
      style={{ backgroundColor: 'rgba(13, 27, 42, 0.75)', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-300 shadow-2xl flex flex-col overflow-hidden w-[96vw] max-w-6xl h-[92vh]"
        style={{ backgroundColor: '#FFFFFF', color: '#0D1B2A' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-3.5 bg-[#0D1B2A] text-white flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center space-x-2">
                <span>Sanitary Catalogue Upload & Reference Extractor</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-400 text-slate-900 font-bold font-mono">
                  Auto-Fetch Engine
                </span>
              </h2>
              <p className="text-xs text-[#CBD5E1]">
                Upload PDF manufacturer price lists or spreadsheets to auto-populate Description, Image & MRP when entering Item Codes
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Import Mode Tabs */}
            <div className="flex items-center bg-white/10 border border-white/20 rounded-lg p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('pdf')}
                className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-all ${
                  activeTab === 'pdf'
                    ? 'bg-teal-500 text-slate-900 font-bold shadow-xs'
                    : 'text-[#E0E1DD] hover:text-white'
                }`}
              >
                <FileText size={13} />
                <span>PDF Catalogue</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('excel')}
                className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-all ${
                  activeTab === 'excel'
                    ? 'bg-teal-500 text-slate-900 font-bold shadow-xs'
                    : 'text-[#E0E1DD] hover:text-white'
                }`}
              >
                <FileSpreadsheet size={13} />
                <span>Excel / CSV</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Status / Alerts */}
        {error && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center space-x-2 shrink-0">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
        {importSuccess && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center space-x-2 shrink-0">
            <Check size={16} className="shrink-0 text-emerald-600" />
            <span>{importSuccess}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden p-4 gap-4 bg-[#F4F5F7]">
          {/* Left Column: PDF Viewer / Visual Extractor Canvas */}
          {activeTab === 'pdf' ? (
            <div
              className="w-1/2 flex flex-col bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs"
              style={{ width: '50%' }}
            >
              {/* PDF Controls Header */}
              <div className="p-3 border-b border-slate-200 bg-slate-100 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className="btn btn-sm bg-[#1B263B] hover:bg-[#0D1B2A] text-white font-bold inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg shadow-xs"
                  >
                    <Upload size={13} />
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
                    <span
                      className="text-xs font-semibold text-slate-800 font-mono truncate max-w-[150px]"
                      title={pdfFile.name}
                    >
                      {pdfFile.name}
                    </span>
                  )}
                </div>

                {numPages > 0 && (
                  <div className="flex items-center space-x-1.5 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-2xs">
                    <button
                      type="button"
                      disabled={currentPage <= 1 || renderingPage}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                      title="Previous page"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <span className="text-xs font-mono font-bold text-slate-900 px-1">
                      {currentPage} / {numPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= numPages || renderingPage}
                      onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                      title="Next page"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </div>

              {/* Action Toolbar above Canvas */}
              {pdfDoc && (
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-bold text-slate-700">Brand:</label>
                    <input
                      type="text"
                      className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-bold text-xs"
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
                      className="btn btn-sm bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center space-x-1 px-3 py-1 font-bold rounded-lg shadow-xs"
                      title="Scan current page text for codes and prices"
                    >
                      <Sparkles size={13} className={isScanningPage ? 'animate-spin' : ''} />
                      <span>{isScanningPage ? 'Scanning...' : 'Auto-Scan Page'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCropMode((prev) => !prev)}
                      className={`btn btn-sm inline-flex items-center space-x-1 px-3 py-1 font-bold rounded-lg shadow-xs ${
                        cropMode
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                      }`}
                      title="Drag to crop product photo directly from page"
                    >
                      <Camera size={13} />
                      <span>{cropMode ? 'Cancel Crop' : 'Crop Photo'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Canvas Container with slate-700 background so white PDF page stands out */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-4 relative bg-[#334155]">
                {renderingPage && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                    <div className="bg-white/95 px-4 py-2 rounded-xl flex items-center space-x-2 shadow-lg">
                      <RefreshCw className="animate-spin text-teal-700" size={18} />
                      <span className="text-xs font-bold text-slate-800">Rendering Page...</span>
                    </div>
                  </div>
                )}

                <div
                  className="relative shadow-2xl rounded overflow-hidden"
                  style={{ display: pdfDoc ? 'block' : 'none' }}
                >
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    className={`max-w-full h-auto bg-white ${
                      cropMode ? 'cursor-crosshair' : 'cursor-default'
                    }`}
                  />
                  {/* Visual Crop Selection Box */}
                  {cropMode && cropRect && (
                    <div
                      className="absolute border-2 border-amber-400 bg-amber-400/30 pointer-events-none"
                      style={{
                        left: `${cropRect.x}px`,
                        top: `${cropRect.y}px`,
                        width: `${cropRect.w}px`,
                        height: `${cropRect.h}px`,
                      }}
                    />
                  )}
                </div>

                {!pdfDoc && (
                  <div className="text-center p-8 bg-white/10 rounded-2xl border border-white/20 text-slate-200">
                    <Upload size={40} className="mx-auto mb-2 text-teal-300 opacity-80" />
                    <p className="text-sm font-bold text-white">No PDF Catalogue Loaded</p>
                    <p className="text-xs text-slate-300 mt-1 max-w-xs">
                      Click "Select PDF File" above to load manufacturer catalogue (Cera, Jaquar, Kohler, Hindware, etc.)
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Excel / CSV Import Section */
            <div
              className="w-1/2 flex flex-col bg-white border border-slate-300 rounded-xl p-5 overflow-y-auto space-y-4 shadow-xs"
              style={{ width: '50%' }}
            >
              <div className="text-center p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-teal-500 transition-colors bg-slate-50">
                <FileSpreadsheet size={40} className="mx-auto mb-2 text-teal-700 opacity-80" />
                <h3 className="text-sm font-bold text-slate-900">Import Catalogue from CSV / Spreadsheet</h3>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                  Upload an Excel (.csv or .tsv) price list with columns: <code>Item Code</code>, <code>Description</code>, <code>MRP</code>, <code>Brand</code>, <code>Category</code>
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => excelInputRef.current?.click()}
                    className="btn btn-sm bg-[#1B263B] hover:bg-[#0D1B2A] text-white font-bold inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg shadow-xs"
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
                <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet size={16} className="text-emerald-700" />
                    <span className="font-bold text-slate-900">{excelFile.name}</span>
                  </div>
                  <span className="text-slate-600 font-mono">{(excelFile.size / 1024).toFixed(1)} KB</span>
                </div>
              )}

              {/* Sample Structure Guide */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 text-slate-700">
                <span className="font-bold text-slate-900 block">Expected CSV Format:</span>
                <code className="block p-2 rounded bg-slate-200 text-[11px] text-slate-900 font-mono">
                  Item Code, Description, MRP, Brand, Category<br />
                  SN-WC-101, Wall Hung Rimless Water Closet, 14500, Cera, Water Closet<br />
                  SN-WB-301, Table Top Oval Ceramic Basin, 6800, Cera, Wash Basin
                </code>
              </div>
            </div>
          )}

          {/* Right Column: Staged Line Items List & Quick Add Form */}
          <div
            className="w-1/2 flex flex-col bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs"
            style={{ width: '50%' }}
          >
            {/* Header */}
            <div className="p-3 border-b border-slate-200 bg-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Layers size={16} className="text-teal-700" />
                <span className="text-xs font-bold text-[#0D1B2A] uppercase tracking-wider">
                  Extracted / Staged Items ({stagedItems.length})
                </span>
              </div>

              {stagedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStagedItems([])}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Quick Add Form */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2">
              <div className="text-[11px] font-bold text-[#1B263B] uppercase tracking-wider flex items-center justify-between">
                <span>Quick Add Item</span>
                {manualImage && (
                  <span className="text-[10px] text-emerald-700 font-bold">✓ Photo Cropped</span>
                )}
              </div>
              <div className="grid grid-cols-12 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Item Code *"
                  className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono uppercase font-bold text-xs focus:outline-none focus:border-teal-600"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Description *"
                  className="col-span-4 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium text-xs focus:outline-none focus:border-teal-600"
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="MRP (₹)"
                  className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono font-bold text-xs text-right focus:outline-none focus:border-teal-600"
                  value={manualMrp}
                  onChange={(e) => setManualMrp(e.target.value)}
                />
                <select
                  className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium text-[11px] focus:outline-none focus:border-teal-600"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="col-span-1 btn btn-sm bg-[#1B263B] hover:bg-[#0D1B2A] text-white font-bold p-0 flex items-center justify-center rounded-lg shadow-xs"
                  title="Add to Staged Items"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Staged Items List Table */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
              {stagedItems.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-8 text-slate-400">
                  <div>
                    <Sparkles size={32} className="mx-auto mb-2 text-teal-600 opacity-60" />
                    <p className="text-xs font-bold text-slate-700">No items staged yet</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                      Click <strong>"Auto-Scan Page"</strong> on the left, crop a photo, or use the Quick Add form to build the catalog list.
                    </p>
                  </div>
                </div>
              ) : (
                stagedItems.map((it) => (
                  <div
                    key={it.id}
                    className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors gap-2 text-xs"
                  >
                    {/* Thumbnail */}
                    <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                      {it.item_image ? (
                        <img
                          src={it.item_image}
                          alt={it.item_code}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera size={16} className="text-slate-400" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          value={it.item_code}
                          onChange={(e) =>
                            handleUpdateStaged(it.id, 'item_code', e.target.value.toUpperCase())
                          }
                          className="w-28 px-1.5 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold uppercase text-xs text-slate-900"
                        />
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-900 font-bold border border-teal-200">
                          {it.category}
                        </span>
                        {it.page_number && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            p.{it.page_number}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={it.item_description}
                        onChange={(e) => handleUpdateStaged(it.id, 'item_description', e.target.value)}
                        className="w-full px-1.5 py-0.5 rounded border border-slate-200 hover:border-slate-300 bg-white text-slate-800 text-xs font-medium"
                        placeholder="Item Description"
                      />
                    </div>

                    {/* MRP & Delete */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-500 block">MRP (₹)</span>
                        <input
                          type="number"
                          value={it.mrp_price || ''}
                          onChange={(e) =>
                            handleUpdateStaged(it.id, 'mrp_price', parseFloat(e.target.value) || 0)
                          }
                          className="w-20 px-1.5 py-0.5 rounded border border-slate-300 bg-white text-right text-emerald-800 font-mono font-bold text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteStaged(it.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Footer for Right Column */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-700">
                Ready to save: <strong className="text-teal-900 font-mono">{stagedItems.length}</strong> products
              </span>

              <button
                type="button"
                disabled={stagedItems.length === 0 || isImporting}
                onClick={handleSaveToCatalog}
                className="btn btn-sm bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold flex items-center space-x-1.5 px-4 py-2 rounded-xl shadow-xs"
              >
                {isImporting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                <span>{isImporting ? 'Importing...' : `Save ${stagedItems.length} Items to Catalog`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-600">
            💡 Once imported, any salesperson typing these Item Codes in Sanitary Quotations will have Description, Image & MRP auto-filled instantly.
          </p>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm px-4 py-1.5 rounded-lg text-xs font-bold text-slate-800 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
