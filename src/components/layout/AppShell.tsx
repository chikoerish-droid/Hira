import { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  Plug,
  RotateCcw,
  Settings,
  ShieldCheck,
  Tag,
  Truck,
  Workflow,
  X,
} from 'lucide-react';
import { BRAND_CONFIG, NAV_ITEMS, type NavSectionId } from '../../config/brand';
import { useStoreState } from '../../store/useStoreState';

interface AppShellProps {
  activeSection: NavSectionId;
  onNavigate: (section: NavSectionId) => void;
  onOpenApprovals: () => void;
  children: React.ReactNode;
}

const SECTION_ICONS: Record<NavSectionId, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  operator: Bot,
  automations: Workflow,
  products: Package,
  orders: ClipboardList,
  customers: MessageSquare,
  inventory: Boxes,
  shipping: Truck,
  returns: RotateCcw,
  promotions: Tag,
  analytics: BarChart3,
  integrations: Plug,
  activity: Activity,
  settings: Settings,
};

export function AppShell({ activeSection, onNavigate, onOpenApprovals, children }: AppShellProps) {
  const { state, pendingApprovalsCount } = useStoreState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) ?? NAV_ITEMS[0];
  const groups: Array<'Workspace' | 'Operations' | 'Intelligence' | 'System'> = [
    'Workspace',
    'Operations',
    'Intelligence',
    'System',
  ];

  const handleNavClick = (id: NavSectionId) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">
            {BRAND_CONFIG.productName}
          </span>
          <span className="text-[11px] font-mono text-slate-500">Demo Sandbox</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 truncate">{state.store.name}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Main navigation">
        {groups.map((group) => (
          <div key={group}>
            <p className="px-2.5 mb-1.5 text-xs font-medium text-slate-400">{group}</p>
            <ul className="space-y-0.5">
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = SECTION_ICONS[item.id];
                const isActive = activeSection === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors min-h-[40px] ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4 text-xs text-slate-600 space-y-1.5">
        <p className="font-semibold text-slate-900">{BRAND_CONFIG.demoBannerLabel}</p>
        <p className="leading-relaxed text-slate-500">
          Changes persist locally in your browser. No live store or payment gateway is connected.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full bg-white">
            <div className="absolute right-2 top-2 z-20">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded p-2 text-slate-600 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar adhering to clean 3-zone contract */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-semibold text-slate-900 truncate">{state.store.name}</span>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="text-slate-600 truncate">{currentNav.label}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 whitespace-nowrap shrink-0">
            {BRAND_CONFIG.demoBannerLabel}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenApprovals}
              className={`inline-flex items-center gap-1.5 rounded border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                pendingApprovalsCount > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Approvals</span>
              <span className="font-mono tabular-nums font-semibold">({pendingApprovalsCount})</span>
            </button>

            {activeSection !== 'operator' && (
              <button
                type="button"
                onClick={() => onNavigate('operator')}
                className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Bot className="h-3.5 w-3.5 shrink-0" />
                <span>Ask {BRAND_CONFIG.productName}</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
