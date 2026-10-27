import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import {
  Server,
  AlertCircle,
  ShieldCheck,
  User as UserIcon,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
} from 'lucide-react';

interface Props {
  onOpenServerSettings: () => void;
}

export const Login: React.FC<Props> = ({ onOpenServerSettings }) => {
  const { login, loginAsRole } = useAuth();
  const { status, serverUrl } = useServer();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1-Click Administrator Instant Login
  const handleAdminLogin = async () => {
    setError(null);
    setAdminLoading(true);
    try {
      await loginAsRole('admin');
    } catch (err: any) {
      setError(err.message || 'Administrator login failed. Please verify the host server connection.');
    } finally {
      setAdminLoading(false);
    }
  };

  // Standard Login with Username & Password (for Salespersons & Staff)
  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password. Please contact your Administrator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col justify-center items-center p-4">
      <div className="card w-full max-w-lg overflow-hidden shadow-2xl border border-[#CBD5E1] animate-page-enter">
        {/* Top Header Banner */}
        <div className="bg-[#0D1B2A] text-[#E0E1DD] p-6 text-center relative">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[11px] font-semibold tracking-wider uppercase mb-2.5 border border-emerald-400/30">
            <Sparkles size={12} className="text-emerald-400" />
            <span>Central Quotation Network</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#E0E1DD]">AMA CERAMICS PVT LTD</h1>
          <p className="text-xs text-[#778DA9] mt-1 font-medium">
            Architectural Surfaces, Vitrified Tiles & Luxury Sanitaries
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
            className="text-blue-700 hover:text-blue-800 text-xs font-semibold flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded border border-blue-200 transition-colors cursor-pointer"
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
                  <span className="text-[11px] text-amber-700">Connect to the host PC LAN IP to sign in.</span>
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
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start space-x-2 shadow-2xs animate-fade-in">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* 1. Quick Administrator Access Card */}
          <div className="border border-indigo-200 rounded-xl p-4 bg-gradient-to-r from-indigo-50/70 to-slate-50 relative overflow-hidden shadow-2xs">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="font-extrabold text-slate-900 text-sm">Administrator Access</h2>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Admin Role
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Full control, user management, password reset & permissions
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-indigo-100/80 flex items-center justify-between">
              <span className="text-[11px] text-indigo-700 font-semibold flex items-center space-x-1">
                <Sparkles size={13} className="text-indigo-500" />
                <span>1-Click Instant Login Active</span>
              </span>
              <button
                type="button"
                disabled={adminLoading || loading}
                onClick={handleAdminLogin}
                className="btn btn-sm bg-indigo-600 hover:bg-indigo-500 text-white font-bold border-none shadow px-4 flex items-center space-x-1.5 cursor-pointer"
              >
                <span>{adminLoading ? 'Signing in...' : 'Sign In as Administrator'}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
              Or Sign In With Credentials
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* 2. Salesperson & Staff Login Form */}
          <form onSubmit={handleCredentialSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon size={15} />
                </div>
                <input
                  type="text"
                  className="input pl-9 text-xs w-full font-medium"
                  placeholder="Enter your unique salesperson username..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading || adminLoading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={15} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-9 pr-9 text-xs w-full font-mono"
                  placeholder="Enter your password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || adminLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || adminLoading || !username.trim() || !password}
              className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md cursor-pointer mt-2"
            >
              <KeyRound size={14} />
              <span>{loading ? 'Authenticating...' : 'Sign In with Credentials'}</span>
            </button>

            <p className="text-[11px] text-slate-400 text-center pt-1">
              Every sales associate has unique login credentials assigned and managed by the Administrator.
            </p>
          </form>
        </div>

        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
          <span>Security: Direct LAN Session</span>
          <span>AMA Quotation System v2.4.7</span>
        </div>
      </div>
    </div>
  );
};
