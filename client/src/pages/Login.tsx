import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { Lock, User as UserIcon, Server, AlertCircle, ShieldCheck } from 'lucide-react';

interface Props {
  onOpenServerSettings: () => void;
}

export const Login: React.FC<Props> = ({ onOpenServerSettings }) => {
  const { login } = useAuth();
  const { status, serverUrl } = useServer();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setRolePreset = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col justify-center items-center p-4">
      <div className="card w-full max-w-md overflow-hidden shadow-lg border border-[#E0E1DD] animate-page-enter">
        {/* Top Header Banner */}
        <div className="bg-[#0D1B2A] text-[#E0E1DD] p-6 text-center">
          <div className="inline-block px-2.5 py-0.5 bg-[#415A77]/40 text-[#E0E1DD] rounded-full text-[10px] font-semibold tracking-wider uppercase mb-2 border border-[#778DA9]/30">
            Windows Desktop Client
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#E0E1DD]">AMA CERAMICS PVT LTD</h1>
          <p className="text-xs text-[#778DA9] mt-1">
            Central LAN Quotation & Estimation System
          </p>
        </div>

        {/* Server status pill */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            ></span>
            <span className="text-slate-600 font-mono text-[11px] truncate max-w-[200px]">
              {serverUrl}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenServerSettings}
            className="text-slate-700 hover:text-blue-600 text-xs font-medium flex items-center space-x-1"
          >
            <Server size={12} />
            <span>Configure LAN</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {status !== 'connected' && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-md text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                <div>
                  <span className="font-semibold block">Host Server Disconnected</span>
                  <span className="text-[11px] text-amber-700">Enter your Host PC's LAN IP address to connect.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenServerSettings}
                className="btn btn-primary btn-xs py-1 px-2.5 text-[11px] shrink-0 font-medium"
              >
                Configure IP
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs flex items-start space-x-2">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <UserIcon size={15} />
              </div>
              <input
                type="text"
                className="input pl-9"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={15} />
              </div>
              <input
                type="password"
                className="input pl-9"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className={`btn btn-primary w-full py-2 mt-2 font-semibold tracking-wide ${loading ? 'btn-saving' : ''}`}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to LAN System'}
          </button>

          {/* Quick presets for office team */}
          <div className="pt-4 border-t border-[#E0E1DD]">
            <p className="text-[10px] font-bold text-[#415A77] uppercase tracking-wider mb-2">
              Select Role Account:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRolePreset('admin', 'adminpassword123')}
                className="p-2 border border-[#E0E1DD] rounded-md text-left hover:bg-[#E0E1DD]/30 hover:border-[#778DA9] transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="font-bold text-[#0D1B2A]">Administrator</div>
                <div className="text-[10px] text-[#415A77]">System Admin</div>
              </button>
              <button
                type="button"
                onClick={() => setRolePreset('manager', 'managerpassword123')}
                className="p-2 border border-[#E0E1DD] rounded-md text-left hover:bg-[#E0E1DD]/30 hover:border-[#778DA9] transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="font-bold text-[#0D1B2A]">Store Manager</div>
                <div className="text-[10px] text-[#415A77]">Rajesh Sharma</div>
              </button>
              <button
                type="button"
                onClick={() => setRolePreset('yasmin', 'salespassword123')}
                className="p-2 border border-[#E0E1DD] rounded-md text-left hover:bg-[#E0E1DD]/30 hover:border-[#778DA9] transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="font-bold text-[#0D1B2A]">Sales Associate</div>
                <div className="text-[10px] text-[#415A77]">Mr Yasmin</div>
              </button>
              <button
                type="button"
                onClick={() => setRolePreset('accounts', 'accountspassword123')}
                className="p-2 border border-[#E0E1DD] rounded-md text-left hover:bg-[#E0E1DD]/30 hover:border-[#778DA9] transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="font-bold text-[#0D1B2A]">Accounts</div>
                <div className="text-[10px] text-[#415A77]">Hardik Shah</div>
              </button>
            </div>
          </div>
        </form>

        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
          <span>Security: Context Isolation Active</span>
          <span>Target: 4 GB RAM Windows</span>
        </div>
      </div>
    </div>
  );
};
