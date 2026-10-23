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
        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
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
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer text-left ${
                isActive
                  ? 'bg-slate-900 text-white font-semibold shadow-sm'
                  : item.isAction
                  ? 'text-blue-600 font-semibold hover:bg-blue-50'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon
                  size={15}
                  className={
                    isActive
                      ? 'text-white'
                      : item.isAction
                      ? 'text-blue-600'
                      : 'text-slate-500'
                  }
                />
                <span>{item.label}</span>
              </div>
              {item.isAction && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 select-none z-10">
      <div className="p-3 overflow-y-auto">
        {renderNavGroup('Operations', operationsNav)}
        {renderNavGroup('Performance', analyticsNav)}
        {adminNav.length > 0 && renderNavGroup('System Admin', adminNav)}
      </div>

      {/* System Footnote */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Cpu size={12} className="text-emerald-600" />
            <span>Memory Mode</span>
          </div>
          <span className="font-semibold text-emerald-700 font-mono text-[10px]">
            4GB RAM Opt.
          </span>
        </div>
        <div className="flex justify-between text-slate-400 text-[10px]">
          <span>App Build:</span>
          <span>v1.0.0 (Win64)</span>
        </div>
      </div>
    </aside>
  );
};
