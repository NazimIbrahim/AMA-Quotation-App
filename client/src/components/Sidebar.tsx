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
        <span className="sidebar-heading">
          {title}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs cursor-pointer text-left ${
                isActive
                  ? 'sidebar-nav-active'
                  : item.isAction
                  ? 'sidebar-nav-action'
                  : 'sidebar-nav-item'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon
                  size={16}
                  className="nav-icon"
                />
                <span className="tracking-wide">{item.label}</span>
              </div>
              {item.isAction && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="w-56 glass-sidebar flex flex-col justify-between shrink-0 select-none z-10 text-[#E0E1DD]">
      <div className="p-3 overflow-y-auto">
        {renderNavGroup('Operations', operationsNav)}
        {renderNavGroup('Performance', analyticsNav)}
        {adminNav.length > 0 && renderNavGroup('System Admin', adminNav)}
      </div>

      {/* System Footnote */}
      <div className="p-3 border-t border-white/10 bg-[#09131F]/80 backdrop-blur-md text-[11px] text-[#778DA9] space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Cpu size={12} className="text-emerald-400" />
            <span className="text-[#E0E1DD]/90 font-medium">Memory Mode</span>
          </div>
          <span className="font-semibold text-emerald-300 font-mono text-[10px] bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 rounded-full shadow-xs">
            4GB RAM Opt.
          </span>
        </div>
        <div className="flex justify-between items-center text-[#778DA9] text-[10px] pt-0.5">
          <span>App Build:</span>
          <span className="font-mono text-[#E0E1DD]/80">v1.3.1 (Win64)</span>
        </div>
      </div>
    </aside>
  );
};
