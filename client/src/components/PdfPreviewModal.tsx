import React, { useState } from 'react';
import {
  Printer,
  Download,
  ExternalLink,
  X,
  FileText,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
  fileName?: string;
}

export const PdfPreviewModal: React.FC<Props> = ({
  isOpen,
  onClose,
  pdfUrl,
  title,
  fileName = 'document.pdf',
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  if (!isOpen) return null;

  const handlePrint = async () => {
    if (window.electronAPI) {
      await window.electronAPI.printQuotationPdf(pdfUrl);
    } else {
      const iframe = document.getElementById('pdf-preview-frame') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } else {
        window.open(pdfUrl, '_blank');
      }
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.downloadFile(pdfUrl, fileName);
        if (res.success) {
          setDownloadSuccess(`Saved to ${res.filePath}`);
          setTimeout(() => setDownloadSuccess(null), 4000);
        } else if (res.error && res.error !== 'Canceled by user') {
          setError(res.error);
        }
      } else {
        // Web browser direct fetch & blob download
        const res = await fetch(pdfUrl);
        if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        setDownloadSuccess('PDF downloaded successfully');
        setTimeout(() => setDownloadSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenExternal = () => {
    if (window.electronAPI) {
      window.electronAPI.openExternal(pdfUrl);
    } else {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="bg-white rounded-lg border border-slate-300 shadow-xl flex flex-col overflow-hidden w-[92vw] h-[92vh] max-w-6xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
                {title}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Official PDF Preview & Print Engine
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {downloadSuccess && (
              <div className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 text-xs font-medium">
                <CheckCircle size={13} />
                <span>{downloadSuccess}</span>
              </div>
            )}

            {error && (
              <div className="flex items-center space-x-1 text-rose-700 bg-rose-50 px-2.5 py-1 rounded border border-rose-200 text-xs font-medium">
                <AlertCircle size={13} />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handlePrint}
              className="btn btn-secondary btn-sm"
              title="Print document directly"
            >
              <Printer size={13} />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn btn-primary btn-sm"
              title="Save PDF file to disk"
            >
              <Download size={13} />
              <span>{downloading ? 'Saving...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handleOpenExternal}
              className="btn btn-secondary btn-sm p-1.5"
              title="Open in new window"
            >
              <ExternalLink size={14} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PDF Embed Area */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
              <div className="text-center">
                <RefreshCw size={24} className="animate-spin text-slate-700 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">Generating Official PDF Document...</p>
                <p className="text-[11px] text-slate-400 mt-0.5">AMA High-Performance Formatting Engine</p>
              </div>
            </div>
          )}

          <iframe
            id="pdf-preview-frame"
            src={pdfUrl}
            title={title}
            className="w-full h-full border-0"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
};
