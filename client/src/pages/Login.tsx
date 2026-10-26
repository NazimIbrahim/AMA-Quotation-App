import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import {
  Server,
  AlertCircle,
  ShieldCheck,
  Briefcase,
  User as UserIcon,
  DollarSign,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Props {
  onOpenServerSettings: () => void;
}

export const Login: React.FC<Props> = ({ onOpenServerSettings }) => {
  const { loginAsRole } = useAuth();
  const { status, serverUrl } = useServer();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [customUsername, setCustomUsername] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleLogin = async (roleKey: string) => {
    setError(null);
    setLoadingRole(roleKey);
    try {
      await loginAsRole(roleKey);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify the host server connection.');
    } finally {
      setLoadingRole(null);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUsername.trim()) return;
    handleRoleLogin(customUsername.trim());
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col justify-center items-center p-4">
      <div className="card w-full max-w-lg overflow-hidden shadow-xl border border-[#CBD5E1] animate-page-enter">
        {/* Top Header Banner */}
        <div className="bg-[#0D1B2A] text-[#E0E1DD] p-6 text-center relative">
          <div className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[11px] font-semibold tracking-wider uppercase mb-2.5 border border-emerald-400/30">
            <Sparkles size={12} className="text-emerald-400" />
            <span>1-Click Instant Login Active</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#E0E1DD]">AMA CERAMICS PVT LTD</h1>
          <p className="text-xs text-[#778DA9] mt-1 font-medium">
            Central LAN Quotation & Estimation System
          </p>
        </div>

        {/* Server status pill */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            ></span>
            <span className="text-slate-700 font-mono text-[11px] font-semibold truncate max-w-[240px]">
              {serverUrl}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenServerSettings}
            className="text-blue-700 hover:text-blue-800 text-xs font-semibold flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded border border-blue-200 transition-colors"
          >
            <Server size={12} />
            <span>Configure LAN</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {status !== 'connected' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-2.5">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold block">Host Server Disconnected</span>
                  <span className="text-[11px] text-amber-700">Connect to the host PC LAN IP to enable live sharing.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenServerSettings}
                className="btn btn-primary btn-xs py-1 px-3 text-[11px] shrink-0 font-bold"
              >
                Set IP
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start space-x-2 shadow-2xs">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Role Selection Instruction */}
          <div className="text-center space-y-1">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Tap Your Role to Sign In Instantly
            </h2>
            <p className="text-xs text-slate-500">
              No passwords required. Simply click your designated role below.
            </p>
          </div>

          {/* 4 Interactive Role Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Administrator */}
            <button
              type="button"
              disabled={Boolean(loadingRole)}
              onClick={() => handleRoleLogin('admin')}
              className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group shadow-2xs ${
                loadingRole === 'admin'
                  ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 hover:shadow-md hover:-translate-y-0.5 cursor-pointer bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ShieldCheck size={22} />
                </div>
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-100 px-2 py-0.5 rounded-full">
                  Admin Mode
                </span>
              </div>
              <div className="font-extrabold text-slate-900 text-base">Administrator</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Full system control, catalog management & settings
              </div>
              <div className="mt-3 flex items-center text-xs font-bold text-indigo-600 group-hover:text-indigo-800">
                <span>{loadingRole === 'admin' ? 'Logging in...' : 'Sign in as Admin'}</span>
                <ArrowRight size={13} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* 2. Store Manager */}
            <button
              type="button"
              disabled={Boolean(loadingRole)}
              onClick={() => handleRoleLogin('manager')}
              className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group shadow-2xs ${
                loadingRole === 'manager'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-md hover:-translate-y-0.5 cursor-pointer bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Briefcase size={20} />
                </div>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded-full">
                  Manager
                </span>
              </div>
              <div className="font-extrabold text-slate-900 text-base">Store Manager</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Rajesh Sharma • Quotation approvals & rates
              </div>
              <div className="mt-3 flex items-center text-xs font-bold text-blue-600 group-hover:text-blue-800">
                <span>{loadingRole === 'manager' ? 'Logging in...' : 'Sign in as Manager'}</span>
                <ArrowRight size={13} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* 3. Sales Associate (Mr Yasmin) */}
            <button
              type="button"
              disabled={Boolean(loadingRole)}
              onClick={() => handleRoleLogin('yasmin')}
              className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group shadow-2xs ${
                loadingRole === 'yasmin'
                  ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                  : 'border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 hover:shadow-md hover:-translate-y-0.5 cursor-pointer bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 mb-3 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                  <UserIcon size={20} />
                </div>
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider bg-teal-100 px-2 py-0.5 rounded-full">
                  Salesperson
                </span>
              </div>
              <div className="font-extrabold text-slate-900 text-base">Sales Associate</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Mr Yasmin • Create quotations & visual catalogue
              </div>
              <div className="mt-3 flex items-center text-xs font-bold text-teal-600 group-hover:text-teal-800">
                <span>{loadingRole === 'yasmin' ? 'Logging in...' : 'Sign in as Yasmin'}</span>
                <ArrowRight size={13} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* 4. Accounts */}
            <button
              type="button"
              disabled={Boolean(loadingRole)}
              onClick={() => handleRoleLogin('accounts')}
              className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group shadow-2xs ${
                loadingRole === 'accounts'
                  ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-md hover:-translate-y-0.5 cursor-pointer bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <DollarSign size={20} />
                </div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-full">
                  Accounts
                </span>
              </div>
              <div className="font-extrabold text-slate-900 text-base">Accounts & Finance</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Hardik Shah • Payments, billing & quotation register
              </div>
              <div className="mt-3 flex items-center text-xs font-bold text-emerald-600 group-hover:text-emerald-800">
                <span>{loadingRole === 'accounts' ? 'Logging in...' : 'Sign in as Accounts'}</span>
                <ArrowRight size={13} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>

          {/* Optional Custom Username Accordion */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowCustom(!showCustom)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center space-x-1 w-full justify-center py-1 transition-colors"
            >
              <span>Login with Custom Salesperson Username (Optional)</span>
              {showCustom ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showCustom && (
              <form onSubmit={handleCustomSubmit} className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserIcon size={14} />
                  </div>
                  <input
                    type="text"
                    className="input pl-8 input-sm text-xs w-full"
                    placeholder="Enter salesperson username (e.g. sales1, sales2)..."
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={Boolean(loadingRole) || !customUsername.trim()}
                  className="btn btn-primary btn-sm px-4 text-xs font-bold shrink-0"
                >
                  Enter
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
          <span>Security: Direct LAN Session</span>
          <span>AMA Quotation System v2.4.2</span>
        </div>
      </div>
    </div>
  );
};
