export const BRAND_CONFIG = {
  /** Single configuration point for the product working name */
  productName: 'AIRA',
  productSubtitle: 'AI Retail Automation Agent',
  demoBannerLabel: 'DEMO STORE — NOT CONNECTED',
  demoStoreDisclaimer:
    'Interactive sandbox using persistent local demo data. No real products are published, orders shipped, messages sent, or refunds issued.',
  supportEmail: 'ops-demo@example.invalid',
} as const;

export type NavSectionId =
  | 'overview'
  | 'operator'
  | 'automations'
  | 'products'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'shipping'
  | 'returns'
  | 'promotions'
  | 'analytics'
  | 'integrations'
  | 'activity'
  | 'settings';

export interface NavItemConfig {
  id: NavSectionId;
  label: string;
  group: 'Workspace' | 'Operations' | 'Intelligence' | 'System';
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'overview', label: 'Overview', group: 'Workspace' },
  { id: 'operator', label: 'AI Operator', group: 'Workspace' },
  { id: 'automations', label: 'Automations', group: 'Workspace' },
  { id: 'products', label: 'Products', group: 'Operations' },
  { id: 'orders', label: 'Orders', group: 'Operations' },
  { id: 'customers', label: 'Customers & Inbox', group: 'Operations' },
  { id: 'inventory', label: 'Inventory', group: 'Operations' },
  { id: 'shipping', label: 'Shipping', group: 'Operations' },
  { id: 'returns', label: 'Returns', group: 'Operations' },
  { id: 'promotions', label: 'Promotions', group: 'Intelligence' },
  { id: 'analytics', label: 'Analytics', group: 'Intelligence' },
  { id: 'integrations', label: 'Integrations', group: 'System' },
  { id: 'activity', label: 'Activity Log', group: 'System' },
  { id: 'settings', label: 'Settings', group: 'System' },
];
