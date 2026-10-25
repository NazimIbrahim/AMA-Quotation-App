import React, { useState, useEffect } from 'react';
import {
  Bath,
  Search,
  X,
  Plus,
  Image as ImageIcon,
  RefreshCw,
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
        limit: '60',
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
    <div
      className="modal-overlay"
      style={{ backgroundColor: 'rgba(13, 27, 42, 0.75)', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-300 shadow-2xl flex flex-col overflow-hidden w-[96vw] max-w-4xl h-[85vh]"
        style={{ backgroundColor: '#FFFFFF', color: '#0D1B2A' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-3.5 bg-[#0D1B2A] text-white flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <Bath size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Browse Sanitary Catalog</h2>
              <p className="text-xs text-[#CBD5E1]">
                Select any product to auto-fill Code, Description, Image & MRP into your quotation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0 flex flex-col sm:flex-row items-center gap-2 text-xs">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by code, product description, brand..."
              className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium text-xs focus:outline-none focus:border-teal-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <select
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold min-w-[130px] focus:outline-none focus:border-teal-600"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="all">All Brands ({brands.length})</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold min-w-[140px] focus:outline-none focus:border-teal-600"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Grid List */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#F4F5F7]">
          {loading && items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-8 text-slate-500">
              <RefreshCw className="animate-spin text-teal-700 mb-2" size={24} />
              <p className="text-xs font-semibold">Loading Catalog Products...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-8 text-slate-400">
              <div>
                <Bath size={32} className="mx-auto mb-2 opacity-40 text-teal-600" />
                <p className="text-xs font-bold text-slate-700">No items found</p>
                <p className="text-xs text-slate-500 mt-1">Try clearing your search query or brand filter.</p>
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
                  className="group relative flex flex-col p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-500 hover:shadow-md cursor-pointer transition-all duration-150"
                >
                  <div className="flex items-start space-x-3">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {it.item_image ? (
                        <img
                          src={it.item_image}
                          alt={it.item_code}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon size={20} className="text-slate-400" />
                      )}
                    </div>

                    {/* Code & Badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-teal-900 truncate">
                          {it.item_code}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                          {it.category || 'General'}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                        {it.brand || 'Sanitary'}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-800 line-clamp-2 mt-2 leading-relaxed flex-1 font-medium">
                    {it.item_description}
                  </p>

                  {/* Price & Action */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      ₹ {formatCurrency(it.mrp_price)}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm bg-[#1B263B] hover:bg-[#0D1B2A] text-white font-bold text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow-2xs"
                    >
                      <Plus size={12} />
                      <span>Select</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <span>Click any product to insert it directly into the quotation line items</span>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm px-4 py-1 rounded-lg font-bold text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
