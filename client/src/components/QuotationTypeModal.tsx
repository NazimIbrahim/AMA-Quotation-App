import React from 'react';
import { X, Grid, Bath, ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'tiles' | 'sanitary') => void;
}

export const QuotationTypeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectType,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0D1B2A]/95 text-[#E0E1DD] border border-white/20 rounded-2xl shadow-2xl overflow-hidden glass-panel backdrop-blur-xl">
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-400 to-teal-400" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Select Quotation Type</h2>
              <p className="text-xs text-[#778DA9]">Choose the category of quotation you want to generate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#778DA9] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Options */}
        <div className="p-6 space-y-4">
          {/* Tile Quotation Option */}
          <div
            onClick={() => onSelectType('tiles')}
            className="group relative flex items-start p-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-blue-400/50 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-blue-900/30"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0 group-hover:scale-105 transition-transform">
              <Grid size={24} />
            </div>
            <div className="ml-4 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                  Tile Quotation
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 font-mono">
                  Room & Sqft
                </span>
              </div>
              <p className="text-xs text-[#778DA9] mt-1 leading-relaxed">
                Standard tile estimation with room/area breakdown, sqft calculations, box coverage ratios, and multi-brand catalogs.
              </p>
            </div>
            <div className="ml-3 self-center text-[#778DA9] group-hover:text-blue-400 group-hover:translate-x-1 transition-all">
              <ArrowRight size={18} />
            </div>
          </div>

          {/* Sanitary Quotation Option */}
          <div
            onClick={() => onSelectType('sanitary')}
            className="group relative flex items-start p-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-teal-400/50 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-teal-900/30"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600/30 to-cyan-600/30 border border-teal-400/40 flex items-center justify-center text-teal-300 shrink-0 group-hover:scale-105 transition-transform">
              <Bath size={24} />
            </div>
            <div className="ml-4 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
                  Sanitary Quotation
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 font-mono">
                  Images & Nos
                </span>
              </div>
              <p className="text-xs text-[#778DA9] mt-1 leading-relaxed">
                Dedicated sanitary ware estimation with Item Codes, Descriptions, live photo upload, piece quantity (Nos), MRP and discounts.
              </p>
            </div>
            <div className="ml-3 self-center text-[#778DA9] group-hover:text-teal-400 group-hover:translate-x-1 transition-all">
              <ArrowRight size={18} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-[#09131F]/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#778DA9] hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
