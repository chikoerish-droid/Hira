import { useState } from 'react';
import type { NavSectionId } from './config/brand';
import { StoreProvider } from './store/useStoreState';
import { AppShell } from './components/layout/AppShell';
import { ApprovalReviewModal } from './components/shared/ApprovalReviewModal';
import { OverviewPage } from './pages/OverviewPage';
import { AiOperatorPage } from './pages/AiOperatorPage';
import { AutomationsPage } from './pages/AutomationsPage';
import { ProductsPage } from './pages/ProductsPage';
import { OrdersPage } from './pages/OrdersPage';
import { CustomersInboxPage } from './pages/CustomersInboxPage';
import { InventoryPage } from './pages/InventoryPage';
import { ShippingPage } from './pages/ShippingPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { SettingsPage } from './pages/SettingsPage';

function AiraWorkspace() {
  const [activeSection, setActiveSection] = useState<NavSectionId>('overview');
  const [filterHint, setFilterHint] = useState<string | undefined>(undefined);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [focusedApprovalId, setFocusedApprovalId] = useState<string | null>(null);

  const handleNavigate = (section: NavSectionId, hint?: string) => {
    setActiveSection(section);
    setFilterHint(hint);
  };

  const handleOpenApprovals = (approvalId?: string) => {
    setFocusedApprovalId(approvalId ?? null);
    setApprovalModalOpen(true);
  };

  return (
    <AppShell
      activeSection={activeSection}
      onNavigate={(sec) => handleNavigate(sec)}
      onOpenApprovals={() => handleOpenApprovals()}
    >
      {activeSection === 'overview' && (
        <OverviewPage onNavigate={handleNavigate} onOpenApprovals={() => handleOpenApprovals()} />
      )}
      {activeSection === 'operator' && (
        <AiOperatorPage onNavigate={(sec) => handleNavigate(sec)} onOpenApprovals={handleOpenApprovals} />
      )}
      {activeSection === 'automations' && <AutomationsPage />}
      {activeSection === 'products' && <ProductsPage onOpenApprovals={() => handleOpenApprovals()} />}
      {activeSection === 'orders' && (
        <OrdersPage initialFilterHint={filterHint} onOpenApprovals={() => handleOpenApprovals()} />
      )}
      {activeSection === 'customers' && (
        <CustomersInboxPage initialFilterHint={filterHint} onOpenApprovals={() => handleOpenApprovals()} />
      )}
      {activeSection === 'inventory' && (
        <InventoryPage initialFilterHint={filterHint} onOpenApprovals={() => handleOpenApprovals()} />
      )}
      {activeSection === 'shipping' && (
        <ShippingPage initialFilterHint={filterHint} onOpenApprovals={() => handleOpenApprovals()} />
      )}
      {activeSection === 'returns' && <ReturnsPage onOpenApprovals={() => handleOpenApprovals()} />}
      {activeSection === 'promotions' && <PromotionsPage onOpenApprovals={() => handleOpenApprovals()} />}
      {activeSection === 'analytics' && <AnalyticsPage />}
      {activeSection === 'integrations' && <IntegrationsPage />}
      {activeSection === 'activity' && <ActivityLogPage />}
      {activeSection === 'settings' && <SettingsPage />}

      <ApprovalReviewModal
        open={approvalModalOpen}
        onClose={() => setApprovalModalOpen(false)}
        initialApprovalId={focusedApprovalId}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AiraWorkspace />
    </StoreProvider>
  );
}
