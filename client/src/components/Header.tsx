import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useServer } from '../context/ServerContext';
import { Wifi, WifiOff, RefreshCw, User as UserIcon, LogOut, Server } from 'lucide-react';

interface Props {
  onOpenServerSettings: () => void;
}

export const Header: React.FC<Props> = ({ onOpenServerSettings }) => {
  const { user, logout } = useAuth();
  const { status, serverUrl, latencyMs } = useServer();

  const getStatusBadge = () => {
    if (status === 'connected') {
      return (
        <button
          onClick={onOpenServerSettings}
          title={`Central Server: ${serverUrl}\nClick to change connection`}
          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold">LAN Online</span>
          {latencyMs !== null && (
            <span className="text-emerald-600/80 font-mono text-[11px]">({latencyMs}ms)</span>
          )}
        </button>
      );
    }
    if (status === 'connecting') {
      return (
        <button
          onClick={onOpenServerSettings}
          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 cursor-pointer"
        >
          <RefreshCw size={11} className="animate-spin text-amber-600" />
          <span>Connecting...</span>
        </button>
      );
    }
    return (
      <button
        onClick={onOpenServerSettings}
        title="Cannot connect to central server. Click to configure IP."
        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
      >
        <WifiOff size={11} className="text-rose-500" />
        <span>LAN Offline (Configure)</span>
      </button>
    );
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shadow-sm select-none shrink-0 z-20">
      <div className="flex items-center space-x-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-sm border border-slate-800">
            AMA
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                AMA CERAMICS
              </h1>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                LAN
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">
              Quotation Management System
            </p>
          </div>
        </div>

        {/* LAN Status Divider */}
        <div className="pl-4 border-l border-slate-200 flex items-center">
          {getStatusBadge()}
        </div>
      </div>

      {/* Right User Bar */}
      <div className="flex items-center space-x-3">
        {user && (
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-900 leading-tight">
                {user.full_name}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {user.role}
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-medium text-xs">
              {user.full_name.charAt(0).toUpperCase()}
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
