import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Users,
  Layers,
  CreditCard,
  Target,
  BarChart3,
  Building,
  ShieldCheck,
  Database,
  Cpu,
  UserCheck,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'quotations'
  | 'quotation-create'
  | 'salespersons'
  | 'customers'
  | 'products'
  | 'payments'
  | 'targets'
  | 'reports'
  | 'company'
  | 'audit'
  | 'backup';

interface Props {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager';
  const canAudit = isAdmin || isManager;

  const operationsNav = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'quotations' as NavTab, label: 'Quotations', icon: FileText },
    { id: 'salespersons' as NavTab, label: 'Salesperson Dashboard', icon: UserCheck },
    { id: 'quotation-create' as NavTab, label: 'New Quotation', icon: PlusCircle, isAction: true },
    { id: 'customers' as NavTab, label: 'Customers', icon: Users },
    { id: 'products' as NavTab, label: 'Tile Catalog', icon: Layers },
    { id: 'payments' as NavTab, label: 'Payments & Receipts', icon: CreditCard },
  ];

  const analyticsNav = [
    { id: 'targets' as NavTab, label: 'Sales Targets', icon: Target },
    { id: 'reports' as NavTab, label: 'Reports & Export', icon: BarChart3 },
  ];

  const adminNav = [
    ...(isAdmin ? [{ id: 'company' as NavTab, label: 'Company Settings', icon: Building }] : []),
    ...(canAudit ? [{ id: 'audit' as NavTab, label: 'Audit Trail', icon: ShieldCheck }] : []),
    ...(isAdmin ? [{ id: 'backup' as NavTab, label: 'Database Backup', icon: Database }] : []),
  ];

  const renderNavGroup = (title: string, items: typeof operationsNav) => (
    <div className="mb-4">
      <div className="px-3 mb-1.5">
        <span className="text-[10px] font-bold tracking-wider text-[#778DA9] uppercase">
          {title}
        </span>
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer text-left group border-0 ${
                isActive
                  ? 'bg-[#1B263B] text-white font-semibold shadow-sm translate-x-1 border-l-2 border-[#778DA9]'
                  : item.isAction
                  ? 'text-[#E0E1DD] font-semibold bg-[#415A77]/30 hover:bg-[#415A77]/50 hover:translate-x-1'
                  : 'text-[#E0E1DD]/80 hover:bg-[#1B263B]/70 hover:text-white hover:translate-x-1'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon
                  size={15}
                  className={`transition-transform duration-150 group-hover:scale-110 ${
                    isActive
                      ? 'text-[#E0E1DD]'
                      : item.isAction
                      ? 'text-[#778DA9]'
                      : 'text-[#778DA9] group-hover:text-white'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.isAction && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#778DA9] animate-pulse"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="w-56 bg-[#0D1B2A] border-r border-[#1B263B] flex flex-col justify-between shrink-0 select-none z-10 text-[#E0E1DD]">
      <div className="p-3 overflow-y-auto">
        {renderNavGroup('Operations', operationsNav)}
        {renderNavGroup('Performance', analyticsNav)}
        {adminNav.length > 0 && renderNavGroup('System Admin', adminNav)}
      </div>

      {/* System Footnote */}
      <div className="p-3 border-t border-[#1B263B] bg-[#09131F] text-[11px] text-[#778DA9] space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Cpu size={12} className="text-emerald-400" />
            <span className="text-[#E0E1DD]/90 font-medium">Memory Mode</span>
          </div>
          <span className="font-semibold text-emerald-400 font-mono text-[10px] bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
            4GB RAM Opt.
          </span>
        </div>
        <div className="flex justify-between items-center text-[#778DA9] text-[10px] pt-0.5">
          <span>App Build:</span>
          <span className="font-mono text-[#E0E1DD]/70">v1.2.0 (Win64)</span>
        </div>
      </div>
    </aside>
  );
};
