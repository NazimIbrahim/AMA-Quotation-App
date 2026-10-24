import React, { useState } from 'react';
import { ServerProvider, useServer } from './context/ServerContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { ServerSetupModal } from './components/ServerSetupModal';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { QuotationList } from './pages/QuotationList';
import { QuotationDetail } from './pages/QuotationDetail';
import { QuotationEditor } from './pages/QuotationEditor';
import { CustomerManagement } from './pages/CustomerManagement';
import { ProductManagement } from './pages/ProductManagement';
import { PaymentManagement } from './pages/PaymentManagement';
import { TargetsManagement } from './pages/TargetsManagement';
import { ReportsPage } from './pages/ReportsPage';
import { SalespersonDashboard } from './pages/SalespersonDashboard';
import { CompanySettingsPage } from './pages/CompanySettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { BackupRestorePage } from './pages/BackupRestorePage';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { openServerWizard, setOpenServerWizard } = useServer();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null);
  const [isEditingQuotation, setIsEditingQuotation] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-9 h-9 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-semibold text-slate-700">Loading AMA Quotation System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login onOpenServerSettings={() => setOpenServerWizard(true)} />
        <ServerSetupModal isOpen={openServerWizard} onClose={() => setOpenServerWizard(false)} />
      </>
    );
  }

  const handleSelectQuotation = (id: number) => {
    setSelectedQuotationId(id);
    setIsEditingQuotation(false);
    setActiveTab('quotations');
  };

  const handleEditQuotation = (id: number) => {
    setSelectedQuotationId(id);
    setIsEditingQuotation(true);
    setActiveTab('quotations');
  };

  const handleCreateQuotation = () => {
    setSelectedQuotationId(null);
    setIsEditingQuotation(true);
    setActiveTab('quotation-create');
  };

  const handleBackToList = () => {
    setSelectedQuotationId(null);
    setIsEditingQuotation(false);
    setActiveTab('quotations');
  };

  const renderMainContent = () => {
    // If a quotation is being edited or created
    if (isEditingQuotation || activeTab === 'quotation-create') {
      return (
        <QuotationEditor
          quotationId={selectedQuotationId}
          onBack={handleBackToList}
          onSaved={(newId) => {
            setSelectedQuotationId(newId);
            setIsEditingQuotation(false);
            setActiveTab('quotations');
          }}
        />
      );
    }

    // If viewing single quotation detail
    if (selectedQuotationId && activeTab === 'quotations') {
      return (
        <QuotationDetail
          quotationId={selectedQuotationId}
          onBack={() => setSelectedQuotationId(null)}
          onEdit={(id) => handleEditQuotation(id)}
          onRecordPayment={() => {
            setActiveTab('payments');
          }}
        />
      );
    }

    // Standard tab rendering
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            onSelectQuotation={handleSelectQuotation}
            onCreateQuotation={handleCreateQuotation}
          />
        );
      case 'quotations':
        return (
          <QuotationList
            onSelectQuotation={handleSelectQuotation}
            onEditQuotation={handleEditQuotation}
            onCreateQuotation={handleCreateQuotation}
          />
        );
      case 'salespersons':
        return (
          <SalespersonDashboard
            onSelectQuotation={handleSelectQuotation}
            onEditQuotation={handleEditQuotation}
            onCreateQuotation={handleCreateQuotation}
          />
        );
      case 'customers':
        return <CustomerManagement />;
      case 'products':
        return <ProductManagement />;
      case 'payments':
        return <PaymentManagement />;
      case 'targets':
        return <TargetsManagement />;
      case 'reports':
        return <ReportsPage onSelectQuotation={handleSelectQuotation} />;
      case 'company':
        return <CompanySettingsPage />;
      case 'audit':
        return <AuditLogsPage />;
      case 'backup':
        return <BackupRestorePage />;
      default:
        return (
          <Dashboard
            onSelectQuotation={handleSelectQuotation}
            onCreateQuotation={handleCreateQuotation}
          />
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#f4f5f7] overflow-hidden select-none">
      <Header onOpenServerSettings={() => setOpenServerWizard(true)} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f5f7]">
          <div
            key={activeTab + (selectedQuotationId ? `-${selectedQuotationId}` : '') + (isEditingQuotation ? '-edit' : '')}
            className="flex-1 flex flex-col min-w-0 overflow-hidden animate-page-enter"
          >
            {renderMainContent()}
          </div>
        </main>
      </div>

      <ServerSetupModal isOpen={openServerWizard} onClose={() => setOpenServerWizard(false)} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ServerProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ServerProvider>
  );
};
