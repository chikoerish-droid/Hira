import type { Connection } from '../types/domain';

export const CONNECTOR_CATALOG: Connection[] = [
  {
    id: 'conn-demo',
    platform: 'demo_sandbox',
    displayName: 'Local Demo Store Sandbox',
    connectionType: 'demo',
    status: 'demo_active',
    description:
      'Persistent local browser sandbox simulating multi-category e-commerce operations. Every mutation is clearly labeled SIMULATED and logged for audit.',
    requiredScopes: ['local_storage:read_write (demo only)'],
    dataCategories: ['Products & Variants', 'Orders', 'Customers & Inbox', 'Inventory', 'Shipments', 'Returns', 'Promotions'],
    complianceNote:
      'Active demo boundary: no external store is connected, no real customer is contacted, no shipment is dispatched, and no real refund can occur.',
    capabilities: {
      readCatalog: true,
      readOrders: true,
      draftListings: true,
      publishListings: true,
      updateFulfillment: true,
      sendMessages: true,
      issueRefunds: false,
    },
  },
  {
    id: 'conn-shopify',
    platform: 'shopify',
    displayName: 'Shopify Admin API',
    connectionType: 'api',
    status: 'disconnected',
    description:
      'Official OAuth / Admin GraphQL API connector for catalog sync, order management, fulfillment tracking, and draft listings.',
    requiredScopes: ['read_products', 'write_products', 'read_orders', 'write_fulfillments', 'read_inventory', 'write_inventory', 'read_returns'],
    dataCategories: ['Catalog & Variants', 'Orders & Line Items', 'Inventory Levels', 'Fulfillments', 'Discounts'],
    complianceNote:
      'Requires merchant OAuth installation in Shopify Partner dashboard. Never stores raw credentials in browser code; respects Shopify GraphQL cost rate limits.',
    capabilities: {
      readCatalog: true,
      readOrders: true,
      draftListings: true,
      publishListings: true,
      updateFulfillment: true,
      sendMessages: false,
      issueRefunds: false,
    },
  },
  {
    id: 'conn-woocommerce',
    platform: 'woocommerce',
    displayName: 'WooCommerce REST API',
    connectionType: 'api',
    status: 'disconnected',
    description:
      'Official WooCommerce v3 REST API integration for WordPress storefronts with granular read/write permission keys.',
    requiredScopes: ['woocommerce_read', 'woocommerce_write (scoped per endpoint)'],
    dataCategories: ['Products & Attributes', 'Orders & Notes', 'Coupons', 'Stock Quantities', 'Refund Summaries'],
    complianceNote:
      'Keys must be stored server-side via encrypted secret storage. Webhook signatures verified before triggering automations.',
    capabilities: {
      readCatalog: true,
      readOrders: true,
      draftListings: true,
      publishListings: true,
      updateFulfillment: true,
      sendMessages: false,
      issueRefunds: false,
    },
  },
  {
    id: 'conn-bigcommerce',
    platform: 'bigcommerce',
    displayName: 'BigCommerce Store API',
    connectionType: 'api',
    status: 'disconnected',
    description:
      'BigCommerce Catalog, Orders, and Promotions v3 API connector supporting B2B/B2C multi-currency storefronts.',
    requiredScopes: ['store_v2_products', 'store_v2_orders', 'store_v2_customers', 'store_v3_promotions'],
    dataCategories: ['Catalog SKUs', 'Orders & Shipments', 'Customer Groups', 'Promotions'],
    complianceNote:
      'Connects via server-side OAuth token exchange. Respects platform API quotas and store-level RBAC.',
    capabilities: {
      readCatalog: true,
      readOrders: true,
      draftListings: true,
      publishListings: true,
      updateFulfillment: true,
      sendMessages: false,
      issueRefunds: false,
    },
  },
  {
    id: 'conn-marketplace',
    platform: 'marketplace',
    displayName: 'Marketplace Connector (Amazon / Etsy / eBay)',
    connectionType: 'api',
    status: 'disconnected',
    description:
      'Channel-neutral marketplace adapter using official Selling Partner / Open APIs for order ingestion and inventory sync.',
    requiredScopes: ['listings:read_write', 'orders:read', 'fulfillment:write', 'messaging:buyer_seller_templates'],
    dataCategories: ['Marketplace Listings', 'Channel Orders', 'Carrier Confirmations', 'Buyer Inquiries'],
    complianceNote:
      'Strictly follows marketplace messaging policies (no promotional links, template compliance) and official SP-API rate limits.',
    capabilities: {
      readCatalog: true,
      readOrders: true,
      draftListings: true,
      publishListings: true,
      updateFulfillment: true,
      sendMessages: true,
      issueRefunds: false,
    },
  },
  {
    id: 'conn-custom-api',
    platform: 'custom_api',
    displayName: 'Custom Storefront Webhook & API',
    connectionType: 'api',
    status: 'disconnected',
    description:
      'OpenAPI / Webhook adapter for bespoke headless storefronts, ERP inventory feeds, and custom checkout stacks.',
    requiredScopes: ['catalog:read_write', 'orders:read', 'webhooks:verify_hmac'],
    dataCategories: ['Custom Product Schemas', 'Order Events', 'Warehouse Stock Feeds'],
    complianceNote:
      'Requires signed HMAC webhook verification and server-side service authentication.',
    capabilities: {
      readCatalog: true,
      readOrders: true,
      draftListings: true,
      publishListings: false,
      updateFulfillment: true,
      sendMessages: false,
      issueRefunds: false,
    },
  },
  {
    id: 'conn-browser-auth',
    platform: 'browser_authorized',
    displayName: 'User-Authorized Browser Connector',
    connectionType: 'browser_authorized',
    status: 'disconnected',
    description:
      'Optional supervised browser workflow adapter for merchant portals that lack a REST/GraphQL API, operating strictly inside an active user-signed-in session.',
    requiredScopes: ['explicit_user_session_approval', 'per_action_confirmation'],
    dataCategories: ['Visible Portal Tables', 'Draft Form Pre-fill'],
    complianceNote:
      'Permitted ONLY where the site terms allow automation and strictly within the signed-in user permissions. Never bypasses login, MFA, access controls, CAPTCHA, or rate limits.',
    capabilities: {
      readCatalog: true,
      readOrders: true,
      draftListings: true,
      publishListings: false,
      updateFulfillment: false,
      sendMessages: false,
      issueRefunds: false,
    },
  },
];
