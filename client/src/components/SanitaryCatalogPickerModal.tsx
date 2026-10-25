import React, { useState, useEffect } from 'react';
import {
  Bath,
  Search,
  X,
  Check,
  Plus,
  Image as ImageIcon,
  RefreshCw,
  Tag,
} from 'lucide-react';
import { useServer } from '../context/ServerContext';
import { SanitaryCatalogItem } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (item: SanitaryCatalogItem) => void;
}

export const SanitaryCatalogPickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectItem,
}) => {
  const { fetchApi } = useServer();

  const [items, setItems] = useState<SanitaryCatalogItem[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const loadItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '40',
      });
      if (search.trim()) params.append('search', search.trim());
      if (selectedBrand !== 'all') params.append('brand', selectedBrand);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);

      const res = await fetchApi<any>(`/api/sanitary-catalog?${params.toString()}`);
      setItems(res.items || []);
      if (Array.isArray(res.brands)) setBrands(res.brands);
      if (Array.isArray(res.categories)) setCategories(res.categories);
    } catch (err) {
      console.error('Failed to load catalog items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, selectedBrand, selectedCategory]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = setTimeout(() => {
      loadItems();
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl h-[85vh] flex flex-col bg-[#0D1B2A]/95 text-[#E0E1DD] border border-white/20 rounded-2xl shadow-2xl overflow-hidden glass-panel">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#09131F]/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Bath size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Browse Sanitary Catalog</h2>
              <p className="text-[11px] text-[#778DA9]">Select any product to auto-fill Code, Description, Image & MRP into your quotation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#778DA9] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-3 bg-white/5 border-b border-white/10 shrink-0 flex flex-col sm:flex-row items-center gap-2 text-xs">
          <div className="relative flex-1 w-full">
            <Search size={13} className="absolute left-2.5 top-2.5 text-[#778DA9]" />
            <input
              type="text"
              placeholder="Search by code, product description, brand..."
              className="input input-xs pl-8 pr-7 w-full bg-white/10 border-white/20 text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-[#778DA9] hover:text-white"
              >
                <X size={11} />
              </button>
            )}
          </div>

          <select
            className="select select-xs bg-[#0D1B2A] border-white/20 text-white min-w-[130px]"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="all">All Brands ({brands.length})</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            className="select select-xs bg-[#0D1B2A] border-white/20 text-white min-w-[140px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Grid List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-8 text-[#778DA9]">
              <RefreshCw className="animate-spin text-teal-400 mb-2" size={24} />
              <p className="text-xs">Loading Catalog Products...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-8 text-[#778DA9]">
              <div>
                <Bath size={28} className="mx-auto mb-2 opacity-30 text-teal-400" />
                <p className="text-xs font-semibold text-white">No items found</p>
                <p className="text-[11px] mt-1">Try clearing your search query or brand filter.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {items.map((it) => (
                <div
                  key={it.id}
                  onClick={() => {
                    onSelectItem(it);
                    onClose();
                  }}
                  className="group relative flex flex-col p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-teal-400/50 cursor-pointer transition-all hover:shadow-lg hover:shadow-teal-900/30"
                >
                  <div className="flex items-start space-x-3">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg bg-black/40 border border-white/15 overflow-hidden flex items-center justify-center shrink-0">
                      {it.item_image ? (
                        <img src={it.item_image} alt={it.item_code} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={18} className="text-[#778DA9] opacity-40" />
                      )}
                    </div>

                    {/* Code & Badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-teal-300 truncate">
                          {it.item_code}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white font-mono">
                          {it.category || 'General'}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#778DA9] font-medium mt-0.5">{it.brand || 'Sanitary'}</div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-white/90 line-clamp-2 mt-2 leading-relaxed flex-1">
                    {it.item_description}
                  </p>

                  {/* Price & Action */}
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ₹ {formatCurrency(it.mrp_price)}
                    </span>
                    <button
                      type="button"
                      className="btn btn-xs bg-teal-600 hover:bg-teal-500 text-white font-semibold flex items-center space-x-1"
                    >
                      <Plus size={11} />
                      <span>Select</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-white/10 bg-[#09131F]/90 flex items-center justify-between text-xs text-[#778DA9] shrink-0">
          <span>Click any product to insert it directly into the quotation line items</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
