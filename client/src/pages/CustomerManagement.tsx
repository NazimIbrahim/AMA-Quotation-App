import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { Customer } from '../types';
import { Search, Plus, Edit, UserCheck, Phone, MapPin, RefreshCw, X } from 'lucide-react';

export const CustomerManagement: React.FC = () => {
  const { fetchApi, subscribeToEvents } = useServer();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [gstin, setGstin] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetchApi(`/api/customers?limit=50&search=${encodeURIComponent(debouncedSearch)}`);
      setCustomers(res.customers || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [debouncedSearch]);

  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      if (['CUSTOMER_UPDATED'].includes(event.type)) {
        loadCustomers();
      }
    });
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setMobileNumber('');
    setEmail('');
    setDeliveryAddress('');
    setSiteLocation('');
    setGstin('');
    setNotes('');
    setModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setMobileNumber(c.mobile_number);
    setEmail(c.email || '');
    setDeliveryAddress(c.delivery_address || '');
    setSiteLocation(c.site_location || '');
    setGstin(c.gstin || '');
    setNotes(c.notes || '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        mobile_number: mobileNumber,
        email,
        delivery_address: deliveryAddress,
        site_location: siteLocation,
        gstin,
        notes,
      };

      if (editingCustomer) {
        await fetchApi(`/api/customers/${editingCustomer.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await fetchApi('/api/customers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setModalOpen(false);
      loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 overflow-y-auto w-full min-w-0">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customer Directory</h1>
          <p className="text-xs text-gray-500">Manage client contacts, site addresses, and quotation histories</p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary btn-sm flex items-center space-x-1">
          <Plus size={14} />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center space-x-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            className="input input-sm pl-8"
            placeholder="Search by customer name, phone number, or project site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={loadCustomers} className="btn btn-secondary btn-sm flex items-center space-x-1">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading && customers.length === 0 ? (
          <div className="col-span-full text-center py-10 text-gray-400">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="col-span-full text-center py-10 text-gray-400">No customers found.</div>
        ) : (
          customers.map((c) => (
            <div key={c.id} className="card card-hover p-4 rounded-lg border border-[#E0E1DD] shadow-sm space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{c.name}</h3>
                  <div className="flex items-center space-x-1 text-gray-600 mt-1">
                    <Phone size={12} className="text-gray-400" />
                    <span>{c.mobile_number}</span>
                  </div>
                </div>
                <button
                  onClick={() => openEditModal(c)}
                  className="p-1 rounded text-gray-400 hover:text-primary hover:bg-gray-100"
                >
                  <Edit size={14} />
                </button>
              </div>

              {c.site_location && (
                <div className="flex items-center space-x-1 text-primary font-medium">
                  <MapPin size={12} />
                  <span>{c.site_location}</span>
                </div>
              )}

              <p className="text-gray-500 text-[11px] line-clamp-2">
                {c.delivery_address || 'No delivery address recorded'}
              </p>

              <div className="pt-2 border-t border-gray-100 flex justify-between text-gray-500 text-[11px]">
                <span>Quotations: {c.quotations_count || 0}</span>
                <span className="font-semibold text-gray-800">
                  Total Quoted: ₹ {Number(c.total_quoted || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-gray-900">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  className="input input-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Priya Sengupta"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Mobile Contact *</label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="+91 98250 12345"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    className="input input-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Project / Site Name</label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                    placeholder="e.g. Bopal Villa Project"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="e.g. 24AAACA5678Q1Z4"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Delivery Address</label>
                <textarea
                  className="input text-xs"
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Detailed site delivery address"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Notes / Preferences</label>
                <textarea
                  className="input text-xs"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Prefers Italian marble tones and anti-skid surfaces"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className={`btn btn-primary btn-sm ${saving ? 'btn-saving' : ''}`} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
