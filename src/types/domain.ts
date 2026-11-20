export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY';
export type WeightUnit = 'g' | 'kg' | 'oz' | 'lb';
export type DimensionUnit = 'cm' | 'in';
export type DateFormatPreference = 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';

export type StepClassification =
  | 'read_only'
  | 'draft'
  | 'reversible_change'
  | 'consequential_external';

export type ActionOutcomeStatus =
  | 'completed'
  | 'needs_approval'
  | 'simulated'
  | 'failed'
  | 'blocked'
  | 'skipped'
  | 'cancelled';

export interface ApprovalRuleSet {
  autoRunReadOnly: boolean;
  autoPrepareDrafts: boolean;
  requireApprovalToPublishProduct: boolean;
  requireApprovalForBulkPriceOrStock: boolean;
  requireApprovalToLaunchPromotion: boolean;
  requireApprovalToSendCustomerMessage: boolean;
  requireApprovalForFulfillmentOrCancel: boolean;
  requireApprovalForReturnDecision: boolean;
  /** Hard-gated sensitive actions that stay blocked unless explicitly enabled AND supported */
  allowRefundExecution: boolean;
  allowPaymentCaptureOrPayout: boolean;
  allowAccountSecurityChanges: boolean;
  /** Narrow rule-based auto-approval switches with explicit scope & limits */
  narrowRules: {
    autoReplyPolicyFaqOnly: boolean;
    autoReplyMaxOrdersPerRun: number;
    autoFlagDelayedShipments: boolean;
    delayedShipmentThresholdBusinessDays: number;
  };
}

export interface StorePolicy {
  id: string;
  title: string;
  category: 'shipping' | 'returns' | 'pricing' | 'messaging' | 'fulfillment';
  summary: string;
  fullText: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  notifyLowStock: boolean;
  notifyDelayedShipments: boolean;
  notifyPendingApprovals: boolean;
  dailySummaryTimeLocal: string;
}

export interface Store {
  id: string;
  name: string;
  domain: string;
  isDemo: boolean;
  currency: CurrencyCode;
  timezone: string;
  language: string;
  dateFormat: DateFormatPreference;
  weightUnit: WeightUnit;
  dimensionUnit: DimensionUnit;
  shippingSlaBusinessDays: number;
  returnWindowDays: number;
  platformFeeRate: number | null;
  policies: StorePolicy[];
  approvalRules: ApprovalRuleSet;
  notifications: NotificationPreferences;
}

export interface Connection {
  id: string;
  platform:
    | 'demo_sandbox'
    | 'shopify'
    | 'woocommerce'
    | 'bigcommerce'
    | 'marketplace'
    | 'custom_api'
    | 'browser_authorized';
  displayName: string;
  connectionType: 'demo' | 'api' | 'browser_authorized';
  status: 'demo_active' | 'disconnected';
  description: string;
  requiredScopes: string[];
  dataCategories: string[];
  complianceNote: string;
  capabilities: {
    readCatalog: boolean;
    readOrders: boolean;
    draftListings: boolean;
    publishListings: boolean;
    updateFulfillment: boolean;
    sendMessages: boolean;
    issueRefunds: boolean;
  };
}

export type ProductFulfillmentType =
  | 'physical'
  | 'digital_download'
  | 'subscription'
  | 'bundle'
  | 'made_to_order';

export type ProductCategory =
  | 'Electronics'
  | 'Home & Kitchen'
  | 'Beauty & Personal Care'
  | 'Books & Stationery'
  | 'Specialty Groceries'
  | 'Digital Downloads'
  | 'Subscriptions & Bundles'
  | 'Made-to-Order Goods';

export interface Variant {
  id: string;
  productId: string;
  sku: string;
  title: string;
  /** Category-neutral key/value attributes (e.g. Capacity: "900 ml", Finish: "Matte Obsidian") */
  attributes: Record<string, string>;
  price: number;
  /** Null means cost data is genuinely unknown; analytics must never fabricate profit */
  unitCost: number | null;
  stock: number;
  reserved: number;
  lowStockThreshold: number;
  barcode?: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  category: ProductCategory;
  fulfillmentType: ProductFulfillmentType;
  status: 'draft' | 'published' | 'archived';
  imageUrl?: string;
  tags: string[];
  taxable: boolean;
  requiresShipping: boolean;
  weightValue?: number;
  weightUnit?: WeightUnit;
  leadTimeDays?: number;
  seoTitle?: string;
  seoDescription?: string;
  /** Tracks fields extracted by AI that still need human verification */
  unverifiedFields?: string[];
  missingFieldsNote?: string;
  variants: Variant[];
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  discountAmount: number;
}

export interface OrderTimelineEntry {
  id: string;
  timestamp: string;
  actor: string;
  message: string;
  isSimulated: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  channel: 'Web Storefront' | 'Marketplace' | 'Subscription Renewal' | 'Custom Order';
  customerId: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  paymentStatus: 'paid' | 'pending' | 'partially_refunded' | 'refunded';
  fulfillmentStatus: 'unfulfilled' | 'prepared' | 'shipped' | 'delivered' | 'cancelled';
  exceptionFlag: string | null;
  currency: CurrencyCode;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  totalAmount: number;
  shippingAddressDemo: {
    label: 'DEMO DATA';
    recipient: string;
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  lineItems: LineItem[];
  notes: string[];
  timeline: OrderTimelineEntry[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  segment: 'Standard' | 'Repeat' | 'Wholesale' | 'VIP';
  country: string;
  ordersCount: number;
  totalSpent: number;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: 'customer' | 'merchant' | 'aira_draft';
  senderName: string;
  body: string;
  timestamp: string;
  isSimulated: boolean;
  groundedPolicyIds?: string[];
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  orderId?: string;
  orderNumber?: string;
  subject: string;
  channel: 'Email' | 'Store Chat' | 'Order Inquiry';
  status: 'open' | 'waiting' | 'resolved';
  classification: 'shipping_delay' | 'order_status' | 'return_request' | 'product_question' | 'policy_faq' | 'other';
  aiSummary?: string;
  draftReply?: string;
  draftMissingInfo?: string[];
  updatedAt: string;
  messages: Message[];
}

export interface Shipment {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  carrier: string;
  service: string;
  trackingNumber: string;
  trackingState: 'awaiting_fulfillment' | 'label_prepared_demo' | 'in_transit_demo' | 'delayed' | 'delivered_demo';
  delayed: boolean;
  delayReason?: string;
  createdAt: string;
  preparedAt?: string;
  shippedAt?: string;
  estimatedDelivery?: string;
  isSimulated: boolean;
}

export interface ReturnRequest {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  affectedItems: Array<{
    sku: string;
    title: string;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
  }>;
  customerReason: string;
  evidenceSummary: string;
  evidenceAttached: boolean;
  matchedPolicyId: string;
  status: 'pending_review' | 'awaiting_evidence' | 'approved_simulated' | 'declined_simulated';
  requestedAmount: number;
  aiSummary?: string;
  aiDraftResponse?: string;
  timeline: Array<{
    id: string;
    timestamp: string;
    actor: string;
    note: string;
    isSimulated: boolean;
  }>;
  createdAt: string;
}

export interface Promotion {
  id: string;
  name: string;
  code: string;
  targetType: 'products' | 'categories' | 'entire_catalog';
  targetProductIds: string[];
  targetCategories: ProductCategory[];
  excludedProductIds: string[];
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  eligibleCustomers: 'all' | 'repeat_only' | 'first_order';
  startAt: string;
  endAt: string;
  status: 'draft' | 'scheduled_demo' | 'active_demo' | 'ended';
  createdAt: string;
}

export interface InventoryEvent {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  productTitle: string;
  variantTitle: string;
  delta: number;
  previousStock: number;
  newStock: number;
  reason: string;
  actor: string;
  isSimulated: boolean;
  timestamp: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  startedAt: string;
  finishedAt: string;
  mode: 'dry_run' | 'simulated_run';
  status: 'completed_simulated' | 'needs_approval' | 'failed' | 'blocked';
  simulated: true;
  inputsSummary: string;
  stepsExecuted: Array<{
    stepTitle: string;
    classification: StepClassification;
    outcome: ActionOutcomeStatus;
    detail: string;
  }>;
  approvalsTriggered: string[];
  resultSummary: string;
  errorMessage?: string;
  retryCount: number;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  scheduleOrSource: string;
  conditions: string[];
  steps: Array<{
    id: string;
    title: string;
    classification: StepClassification;
  }>;
  approvalPolicy: 'always_review_mutations' | 'narrow_rule_auto' | 'manual_only';
  status: 'paused' | 'active' | 'error';
  retryOnSafeFailure: boolean;
  duplicateGuardWindowMinutes: number;
  lastRunAt?: string;
  lastError?: string;
  runHistory: AutomationRun[];
}

export interface ActionPlanStep {
  id: string;
  title: string;
  description: string;
  classification: StepClassification;
  requiresApproval: boolean;
  blockedReason?: string;
  status: ActionOutcomeStatus;
  affectedRecords: string[];
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  externalMessageText?: string;
  riskNote?: string;
  missingInformation?: string[];
  resultDetail?: string;
  actionType:
    | 'query_orders'
    | 'query_analytics'
    | 'daily_summary'
    | 'create_product_draft'
    | 'publish_product'
    | 'update_order_status'
    | 'prepare_shipment'
    | 'draft_customer_reply'
    | 'send_customer_reply'
    | 'adjust_inventory'
    | 'prepare_promotion'
    | 'apply_promotion'
    | 'review_return'
    | 'issue_refund_blocked';
  payload?: Record<string, unknown>;
}

export interface ActionPlan {
  id: string;
  requestText: string;
  understanding: string;
  retrievedContext: string[];
  assumptions: string[];
  clarificationQuestion?: string;
  steps: ActionPlanStep[];
  createdAt: string;
}

export interface Approval {
  id: string;
  source: 'operator' | 'automation' | 'manual_workflow';
  title: string;
  actionDescription: string;
  classification: StepClassification;
  affectedRecords: string[];
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  externalMessageText?: string;
  riskNote?: string;
  missingInformation?: string[];
  decision: 'pending' | 'approved' | 'edited_approved' | 'cancelled' | 'blocked';
  createdAt: string;
  decidedAt?: string;
  duplicateKey: string;
  onApproveAction: {
    type: ActionPlanStep['actionType'];
    payload: Record<string, unknown>;
  };
}

export interface CustomerSegmentRule {
  id: string;
  name: string;
  description: string;
  minTotalSpent: number;
  minOrderCount: number;
  recencyMode: 'any' | 'within_days' | 'older_than_days';
  recencyDays: number;
  categoryFilter: ProductCategory | 'All';
  createdAt: string;
}

export interface SuggestedTagItem {
  tag: string;
  category: 'Material & Specs' | 'Use Case' | 'Audience & Channel' | 'Merchandising';
  source: 'title' | 'description' | 'image';
  confidence: 'verified' | 'inferred';
  selected: boolean;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  actor: 'AIRA Operator' | 'AIRA Automation' | 'Merchant User' | 'System Guard';
  actionSummary: string;
  targetRecords: string[];
  classification: StepClassification;
  result: ActionOutcomeStatus;
  approvalDecision: 'auto_permitted' | 'approved_by_user' | 'edited_and_approved' | 'cancelled' | 'pending_approval' | 'blocked_by_policy' | 'not_applicable';
  beforeValue?: unknown;
  afterValue?: unknown;
  isSimulated: boolean;
}
