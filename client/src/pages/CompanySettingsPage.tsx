import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { CompanySettings } from '../types';
import { Building, Landmark, FileText, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export const CompanySettingsPage: React.FC = () => {
  const { fetchApi } = useServer();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/api/company');
      setSettings(res.company);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSavedSuccess(false);
    try {
      await fetchApi('/api/company', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update company settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTermChange = (index: number, val: string) => {
    if (!settings) return;
    const newTerms = [...settings.terms_json];
    newTerms[index] = val;
    setSettings({ ...settings, terms_json: newTerms });
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-gray-400">Loading company profile...</div>;
  }

  return (
    <div className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 lg:space-y-6 overflow-y-auto w-full min-w-0">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Company Profile & Quotation Terms</h1>
          <p className="text-xs text-gray-500">
            Showroom details, GSTIN, bank settlement accounts, and official terms applied to PDF quotations
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`btn btn-primary btn-sm flex items-center space-x-1 ${saving ? 'btn-saving' : ''}`}
        >
          <Save size={14} className={saving ? 'animate-spin' : ''} />
          <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-xs flex items-center space-x-2 animate-save-success">
          <CheckCircle2 size={16} className="animate-icon-pop" />
          <span>Company profile and quotation terms updated successfully!</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-center space-x-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Basic Showroom Info */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b pb-2">
            <Building size={16} className="text-primary" />
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Showroom & Entity Information
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Company Name *</label>
              <input
                type="text"
                className="input input-sm font-bold text-primary"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Tagline</label>
              <input
                type="text"
                className="input input-sm"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Address Line 1</label>
              <input
                type="text"
                className="input input-sm"
                value={settings.address_line1}
                onChange={(e) => setSettings({ ...settings, address_line1: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Address Line 2 (City, Pincode)</label>
              <input
                type="text"
                className="input input-sm"
                value={settings.address_line2}
                onChange={(e) => setSettings({ ...settings, address_line2: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Phone / Customer Care</label>
              <input
                type="text"
                className="input input-sm"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">GSTIN *</label>
              <input
                type="text"
                className="input input-sm font-mono font-bold"
                value={settings.gstin}
                onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Email</label>
              <input
                type="email"
                className="input input-sm"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Website</label>
              <input
                type="text"
                className="input input-sm"
                value={settings.website}
                onChange={(e) => setSettings({ ...settings, website: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Bank & Settlement Details */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b pb-2">
            <Landmark size={16} className="text-primary" />
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Settlement Bank & UPI Accounts
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Beneficiary Name (Account Name)</label>
              <input
                type="text"
                className="input input-sm"
                value={settings.account_name}
                onChange={(e) => setSettings({ ...settings, account_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Bank Name</label>
              <input
                type="text"
                className="input input-sm"
                value={settings.bank_name}
                onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Account Number</label>
              <input
                type="text"
                className="input input-sm font-mono"
                value={settings.account_number}
                onChange={(e) => setSettings({ ...settings, account_number: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">IFSC Code</label>
              <input
                type="text"
                className="input input-sm font-mono uppercase"
                value={settings.ifsc_code}
                onChange={(e) => setSettings({ ...settings, ifsc_code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">Branch</label>
              <input
                type="text"
                className="input input-sm"
                value={settings.branch}
                onChange={(e) => setSettings({ ...settings, branch: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-1">UPI & Payment Notes</label>
              <input
                type="text"
                className="input input-sm"
                value={settings.upi_details}
                onChange={(e) => setSettings({ ...settings, upi_details: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* 13 Official Terms and Conditions */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b pb-2">
            <FileText size={16} className="text-primary" />
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Official Quotation Terms & Conditions (Sample PDF Standards)
            </h2>
          </div>

          <div className="space-y-2">
            {settings.terms_json.map((term, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span className="w-6 text-right font-bold text-gray-500">{idx + 1}.</span>
                <input
                  type="text"
                  className="input input-sm flex-1"
                  value={term}
                  onChange={(e) => handleTermChange(idx, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};
