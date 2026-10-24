import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import { TileBrand, BrandSizeCoverage, ProductType } from '../types';
import { Layers, Plus, Tag, RefreshCw, X } from 'lucide-react';

export const ProductManagement: React.FC = () => {
  const { fetchApi } = useServer();
  const { user } = useAuth();

  const [brands, setBrands] = useState<TileBrand[]>([]);
  const [coverages, setCoverages] = useState<BrandSizeCoverage[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // New Brand Modal
  const [brandModal, setBrandModal] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandDesc, setBrandDesc] = useState('');

  // New Coverage Modal
  const [coverageModal, setCoverageModal] = useState(false);
  const [covBrandId, setCovBrandId] = useState<number>(0);
  const [productType, setProductType] = useState<ProductType>('box');
  const [size, setSize] = useState('1200X1800');
  const [coverageSqft, setCoverageSqft] = useState('46.5');
  const [piecesPerBox, setPiecesPerBox] = useState('2');
  const [rateSqft, setRateSqft] = useState('130.0');

  const isAdminOrManager = ['admin', 'manager'].includes(user?.role || '');

  const loadData = async () => {
    setLoading(true);
    try {
      const bRes = await fetchApi('/api/products/brands');
      setBrands(bRes.brands || []);
      if (bRes.brands && bRes.brands.length > 0 && !selectedBrandId) {
        setSelectedBrandId(bRes.brands[0].id);
      }

      const cRes = await fetchApi('/api/products/coverages');
      setCoverages(cRes.coverages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/products/brands', {
        method: 'POST',
        body: JSON.stringify({ name: brandName, description: brandDesc }),
      });
      setBrandModal(false);
      setBrandName('');
      setBrandDesc('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add brand');
    }
  };

  const handleCreateCoverage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/products/coverages', {
        method: 'POST',
        body: JSON.stringify({
          brand_id: covBrandId || selectedBrandId,
          size,
          product_type: productType,
          coverage_sqft: productType === 'box' ? coverageSqft : '0',
          pieces_per_box: productType === 'box' ? piecesPerBox : '1',
          default_rate_sqft: productType === 'sqft' || productType === 'box' ? rateSqft : '0',
          default_rate_box: productType !== 'box' && productType !== 'sqft' ? rateSqft : undefined,
        }),
      });
      setCoverageModal(false);
      setProductType('box');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add size specification');
    }
  };

  const filteredCoverages = selectedBrandId
    ? coverages.filter((c) => c.brand_id === selectedBrandId)
    : coverages;

  return (
    <div className="flex-1 p-6 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tile Brands & Size Specifications</h1>
          <p className="text-xs text-gray-500">
            Configure box coverage formulas, pieces per carton, and standard rates
          </p>
        </div>
        <div className="flex space-x-2">
          {isAdminOrManager && (
            <>
              <button onClick={() => setBrandModal(true)} className="btn btn-secondary btn-sm flex items-center space-x-1">
                <Tag size={12} />
                <span>+ Add Brand</span>
              </button>
              <button
                onClick={() => {
                  setCovBrandId(selectedBrandId || (brands[0]?.id || 1));
                  setCoverageModal(true);
                }}
                className="btn btn-primary btn-sm flex items-center space-x-1"
              >
                <Plus size={12} />
                <span>+ Add Size Formula</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Brands Sidebar & Coverage Table */}
      <div className="grid grid-cols-4 gap-6">
        {/* Brands List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-2">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Ceramic Brands</h2>
          <div className="space-y-1">
            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBrandId(b.id)}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center justify-between ${
                  selectedBrandId === b.id
                    ? 'bg-blue-50 text-primary font-bold border-l-4 border-primary pl-2'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span>{b.name}</span>
                <span className="text-[10px] text-gray-400">
                  {coverages.filter((c) => c.brand_id === b.id).length} sizes
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Coverage Formulas Table */}
        <div className="col-span-3 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center">
            <span className="text-xs font-bold text-primary uppercase tracking-wide">
              {brands.find((b) => b.id === selectedBrandId)?.name || 'All Brands'} — Size & Sqft Coverages
            </span>
            <span className="text-[10px] text-gray-500">Auto-populates quotation line items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600 bg-gray-50/50">
                  <th className="py-2.5 px-3">Size / Specification</th>
                  <th className="py-2.5 px-3">Product Type</th>
                  <th className="py-2.5 px-3 text-right">Coverage / Packaging</th>
                  <th className="py-2.5 px-3 text-right">Default Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCoverages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      No size formulas recorded for this brand. Click "+ Add Size Formula" above.
                    </td>
                  </tr>
                ) : (
                  filteredCoverages.map((c) => {
                    const pType = c.product_type || 'box';
                    const badgeStyles: Record<string, { label: string; cls: string }> = {
                      box: { label: 'Boxes (Box)', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                      pieces: { label: 'Pieces (Pcs)', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
                      sqft: { label: 'Square Feet (Sq.Ft)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                      bags: { label: 'Bags (Bag)', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                      nos: { label: 'Numbers (Nos)', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
                    };
                    const badge = badgeStyles[pType] || badgeStyles['box'];

                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-bold text-gray-900">{c.size}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-700 font-medium">
                          {pType === 'box'
                            ? `${Number(c.coverage_sqft).toFixed(2)} sqft/box (${c.pieces_per_box} pcs)`
                            : pType === 'sqft'
                            ? '1.00 Sq.Ft Unit'
                            : pType === 'bags'
                            ? '1 Bag Packaging'
                            : pType === 'pieces'
                            ? '1 Piece Unit'
                            : '1 Unit (Nos)'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                          {pType === 'box' ? (
                            <span>
                              ₹ {Number(c.default_rate_sqft).toFixed(2)} <span className="text-[10px] text-gray-500 font-normal">/ sqft</span> (₹ {Number(c.default_rate_box).toFixed(2)} / box)
                            </span>
                          ) : pType === 'sqft' ? (
                            <span>
                              ₹ {Number(c.default_rate_sqft).toFixed(2)} <span className="text-[10px] text-gray-500 font-normal">/ sqft</span>
                            </span>
                          ) : (
                            <span>
                              ₹ {Number(c.default_rate_box || c.default_rate_sqft).toFixed(2)}{' '}
                              <span className="text-[10px] text-gray-500 font-normal">
                                / {pType === 'bags' ? 'bag' : pType === 'pieces' ? 'pc' : 'no'}
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Brand Modal */}
      {brandModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-gray-900">Add Ceramic Brand</h2>
              <button onClick={() => setBrandModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBrand} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Brand Name *</label>
                <input
                  type="text"
                  className="input input-sm"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Somany Ceramics"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  className="input input-sm"
                  value={brandDesc}
                  onChange={(e) => setBrandDesc(e.target.value)}
                  placeholder="e.g. Glazed vitrified tiles and heavy duty slabs"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBrandModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Size Formula Modal */}
      {coverageModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-gray-900">Add Size Formula</h2>
              <button onClick={() => setCoverageModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCoverage} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Brand *</label>
                <select
                  className="input input-sm"
                  value={covBrandId}
                  onChange={(e) => setCovBrandId(parseInt(e.target.value, 10))}
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Type / Packaging Unit */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Product Type / Packaging Unit *</label>
                <select
                  className="input input-sm font-semibold text-primary"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value as ProductType)}
                >
                  <option value="box">Boxes (Box) — Default Tile Packaging</option>
                  <option value="pieces">Pieces (Pcs) — Single Tiles / Slabs</option>
                  <option value="sqft">Square Feet (Sq.Ft) — Direct Area Sizing</option>
                  <option value="bags">Bags (Bag) — Adhesives / Grouts / Mortar</option>
                  <option value="nos">Numbers (Nos) — Accessories / Trims / Spacers</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Dimensions / Spec Name *</label>
                <input
                  type="text"
                  className="input input-sm"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder={
                    productType === 'box'
                      ? 'e.g. 1200X1800, 600X1200'
                      : productType === 'sqft'
                      ? 'e.g. Custom Cut Sqft, Polished Slab'
                      : productType === 'bags'
                      ? 'e.g. 20kg Bag, 5kg Epoxy Grout'
                      : productType === 'pieces'
                      ? 'e.g. 800X1600 Step Tile, Bullnose'
                      : 'e.g. Tile Spacers 2mm, Leveling Clips'
                  }
                  required
                />
              </div>

              {productType === 'box' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Sqft per Box *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input input-sm"
                      value={coverageSqft}
                      onChange={(e) => setCoverageSqft(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">Pieces per Box</label>
                    <input
                      type="number"
                      className="input input-sm"
                      value={piecesPerBox}
                      onChange={(e) => setPiecesPerBox(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  {productType === 'box'
                    ? 'Default Rate per Sqft (INR) *'
                    : productType === 'sqft'
                    ? 'Default Rate per Sqft (INR) *'
                    : productType === 'bags'
                    ? 'Default Rate per Bag (INR) *'
                    : productType === 'pieces'
                    ? 'Default Rate per Piece (INR) *'
                    : 'Default Rate per No (INR) *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input input-sm"
                  value={rateSqft}
                  onChange={(e) => setRateSqft(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCoverageModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Specification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
