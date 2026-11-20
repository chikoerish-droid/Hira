import type { DemoStoreState } from '../data/seedStore';
import type { ActionPlan, ActionPlanStep, ProductCategory } from '../types/domain';
import { computeAnalyticsSummary, isOrderPastSla } from './analyticsEngine';
import { evaluateStepPermission } from './approvalEngine';

export interface OperatorAttachment {
  name: string;
  mimeType: string;
  textContent?: string;
  base64Data?: string;
  previewUrl?: string;
}

export const EXAMPLE_OPERATOR_PROMPTS = [
  'Create draft listings from these product photos and this spreadsheet.',
  'Show me paid orders that have not shipped within two business days.',
  'Draft a reply to this customer using our shipping policy and their order status.',
  'Which products are selling fastest this month, and which are low in stock?',
  'Prepare a discount for these products, but don’t apply it yet.',
  'At the end of each day, summarize sales, cancellations, refunds, and orders that need attention.',
];

export const CATEGORY_ATTRIBUTE_TEMPLATES: Record<ProductCategory, string[]> = {
  Electronics: ['Finish', 'Connectivity', 'Voltage / Battery', 'Warranty'],
  'Home & Kitchen': ['Capacity', 'Voltage', 'Material', 'Care Instructions'],
  'Beauty & Personal Care': ['Volume', 'Packaging', 'Formulation', 'Key Ingredients'],
  'Books & Stationery': ['Format', 'Paper / Pages', 'Binding', 'Edition'],
  'Specialty Groceries': ['Weight / Net Qty', 'Grind / Cut', 'Roast / Origin', 'Shelf Life'],
  'Digital Downloads': ['License Tier', 'File Format', 'Delivery Method', 'Version'],
  'Subscriptions & Bundles': ['Billing Interval', 'Bundle Contents', 'Roast / Tier'],
  'Made-to-Order Goods': ['Dimensions', 'Material', 'Lead Time', 'Personalization'],
};

/**
 * Deterministic local planner & store inspector.
 * Used when running local store queries directly or when the user chooses
 * local inspection alongside server-side Gemini reasoning.
 * Never fabricates missing prices, costs, tracking numbers, or order statuses.
 */
export function buildLocalOperatorPlan(
  requestText: string,
  state: DemoStoreState,
  attachments: OperatorAttachment[] = [],
  clarificationAnswer?: string
): ActionPlan {
  const q = `${requestText} ${clarificationAnswer ?? ''}`.toLowerCase();
  const nowIso = new Date().toISOString();
  const planId = `plan-${Date.now()}`;
  const rules = state.store.approvalRules;

  // 1. Paid orders not shipped within 2 business days
  if (q.includes('not shipped') || q.includes('two business days') || q.includes('2 business days') || q.includes('unfulfilled')) {
    const overdueOrders = state.orders.filter((o) => isOrderPastSla(o, state.store.shippingSlaBusinessDays));
    const steps: ActionPlanStep[] = [
      {
        id: `${planId}-s1`,
        title: `Inspect paid orders unfulfilled past ${state.store.shippingSlaBusinessDays} business days`,
        description: `Checked ${state.orders.length} demo orders against store shipping SLA (${state.store.shippingSlaBusinessDays} business days).`,
        classification: 'read_only',
        requiresApproval: false,
        status: 'completed',
        affectedRecords: overdueOrders.map((o) => o.orderNumber),
        resultDetail:
          overdueOrders.length > 0
            ? `Found ${overdueOrders.length} paid unfulfilled orders past SLA: ${overdueOrders
                .map((o) => `${o.orderNumber} (${o.customerName}, ${o.createdAt.slice(0, 10)})`)
                .join('; ')}.`
            : 'No paid orders currently exceed the 2-business-day shipping SLA.',
        actionType: 'query_orders',
      },
    ];

    if (overdueOrders.length > 0) {
      const first = overdueOrders[0];
      const prepEval = evaluateStepPermission({ actionType: 'prepare_shipment', classification: 'reversible_change' }, rules);
      steps.push({
        id: `${planId}-s2`,
        title: `Prepare demo fulfillment & exception note for ${first.orderNumber}`,
        description: 'Prepare shipment record in Demo Store without purchasing a real carrier label.',
        classification: 'reversible_change',
        requiresApproval: prepEval.decision === 'needs_approval',
        status: prepEval.decision === 'needs_approval' ? 'needs_approval' : 'simulated',
        affectedRecords: [first.orderNumber],
        oldValues: { fulfillmentStatus: first.fulfillmentStatus, trackingNumber: 'None' },
        newValues: { fulfillmentStatus: 'prepared (demo)', carrier: 'UPS (Demo)', service: 'Standard Ground' },
        riskNote: 'Simulated only in Demo Store. Real fulfillment requires a connected store/carrier API.',
        actionType: 'prepare_shipment',
        payload: { orderId: first.id, carrier: 'UPS (Demo)', service: 'Standard Ground' },
      });
    }

    return {
      id: planId,
      requestText,
      understanding: `Identify paid orders in ${state.store.name} that remain unfulfilled beyond the configured ${state.store.shippingSlaBusinessDays}-business-day SLA.`,
      retrievedContext: [
        `Store Policy: Standard & Express Shipping SLA (${state.store.shippingSlaBusinessDays} business days)`,
        `Orders scanned: ${state.orders.length} total demo orders`,
      ],
      assumptions: ['Digital-only orders are delivered immediately and excluded from physical shipping delays.'],
      steps,
      createdAt: nowIso,
    };
  }

  // 2. End of day summary
  if (q.includes('end of each day') || q.includes('daily summary') || q.includes('summarize sales')) {
    const summary = computeAnalyticsSummary(
      state.orders,
      state.products,
      state.returns,
      state.shipments,
      state.inventoryEvents,
      state.store,
      '30d'
    );
    const openConvs = state.conversations.filter((c) => c.status !== 'resolved');
    const attentionOrders = state.orders.filter((o) => Boolean(o.exceptionFlag) || isOrderPastSla(o, state.store.shippingSlaBusinessDays));

    const costNote = summary.hasCompleteCostData
      ? `Gross profit: $${summary.grossProfit?.toFixed(2)}`
      : `Profit omitted: cost data available for ${summary.itemsWithKnownCostCount} of ${summary.itemsSoldCount} sold units (insufficient cost data to calculate reliable profit).`;

    return {
      id: planId,
      requestText,
      understanding: 'Generate an honest end-of-day operational digest covering sales, cancellations, refunds, delayed shipments, and open conversations.',
      retrievedContext: [
        `${summary.paidOrderCount} paid orders in active 30-day demo window`,
        `${state.returns.length} return requests, ${openConvs.length} open/waiting conversations`,
      ],
      assumptions: ['Calculated strictly from verified demo store records; missing unit costs are never estimated.'],
      steps: [
        {
          id: `${planId}-s1`,
          title: 'Compile daily sales, cancellations, refunds, and exceptions digest',
          description: 'Read-only aggregation across Orders, Shipments, Returns, and Conversations.',
          classification: 'read_only',
          requiresApproval: false,
          status: 'completed',
          affectedRecords: attentionOrders.map((o) => o.orderNumber),
          resultDetail: `Gross Sales: $${summary.grossSales.toFixed(2)} · Net Sales: $${summary.netSales.toFixed(2)} · Cancellations: ${summary.cancelledCount} · Refunds: ${summary.refundedCount} · Orders needing attention: ${attentionOrders.length} · Open/waiting inbox threads: ${openConvs.length}. ${costNote}`,
          actionType: 'daily_summary',
        },
      ],
      createdAt: nowIso,
    };
  }

  // 3. Fastest selling & low stock
  if (q.includes('selling fastest') || q.includes('low in stock') || q.includes('low stock')) {
    const summary = computeAnalyticsSummary(
      state.orders,
      state.products,
      state.returns,
      state.shipments,
      state.inventoryEvents,
      state.store,
      '30d'
    );
    const lowStock = state.products.flatMap((p) =>
      p.variants
        .filter((v) => p.requiresShipping && v.stock - v.reserved <= v.lowStockThreshold)
        .map((v) => `${v.sku} (${p.title} · ${v.title}: ${v.stock - v.reserved} available, threshold ${v.lowStockThreshold})`)
    );

    return {
      id: planId,
      requestText,
      understanding: 'Identify best-selling products in the last 30 days alongside variants at or below low-stock thresholds.',
      retrievedContext: [`Catalog: ${state.products.length} products`, `30d Paid Orders: ${summary.paidOrderCount}`],
      assumptions: ['Available inventory equals on-hand stock minus reserved quantities.'],
      steps: [
        {
          id: `${planId}-s1`,
          title: 'Analyze 30-day best sellers and low-stock variants',
          description: 'Read-only scan of order line items and variant stock thresholds.',
          classification: 'read_only',
          requiresApproval: false,
          status: 'completed',
          affectedRecords: summary.bestSellers.slice(0, 3).map((b) => b.sku),
          resultDetail: `Top sellers (30d): ${summary.bestSellers
            .slice(0, 3)
            .map((b) => `${b.title} (${b.unitsSold} units, $${b.grossRevenue.toFixed(2)})`)
            .join('; ')}. Low-stock alerts (${lowStock.length}): ${lowStock.join('; ') || 'None'}.`,
          actionType: 'query_analytics',
        },
      ],
      createdAt: nowIso,
    };
  }

  // 4. Draft customer reply
  if (q.includes('reply') || q.includes('customer') || q.includes('shipping policy')) {
    const targetConv =
      state.conversations.find((c) => q.includes(c.customerName.toLowerCase()) || (c.orderNumber && q.includes(c.orderNumber.toLowerCase()))) ??
      state.conversations.find((c) => c.status === 'open') ??
      state.conversations[0];
    const linkedOrder = state.orders.find((o) => o.id === targetConv?.orderId);
    const linkedShipment = state.shipments.find((s) => s.orderId === targetConv?.orderId);
    const shipPolicy = state.store.policies.find((p) => p.category === 'shipping');

    const draftText = targetConv
      ? `Hi ${targetConv.customerName},\n\nThank you for reaching out regarding order ${targetConv.orderNumber ?? ''}. According to our current demo order record, payment is ${linkedOrder?.paymentStatus ?? 'recorded'} and fulfillment status is "${linkedOrder?.fulfillmentStatus ?? 'in review'}"${linkedShipment?.trackingNumber ? ` (tracking: ${linkedShipment.trackingNumber})` : ''}.\n\nPer our shipping policy (${shipPolicy?.summary ?? '1–2 business day standard dispatch'}), our operations team is reviewing this order and will share confirmed carrier tracking as soon as dispatch is completed. We cannot confirm an exact delivery date until the carrier scan updates.\n\nBest regards,\n${state.store.name} Support (Demo)`
      : 'No open customer conversations found in demo store.';

    const sendEval = evaluateStepPermission(
      { actionType: 'send_customer_reply', classification: 'consequential_external', payload: { isPolicyFaqOnly: false } },
      rules
    );

    return {
      id: planId,
      requestText,
      understanding: `Draft a policy-grounded customer reply for ${targetConv?.customerName ?? 'customer'} using verified order and shipping records.`,
      retrievedContext: [
        `Conversation: ${targetConv?.subject ?? 'None'}`,
        `Order: ${linkedOrder?.orderNumber ?? 'Not linked'} (${linkedOrder?.fulfillmentStatus ?? 'n/a'})`,
        `Policy: ${shipPolicy?.title ?? 'Shipping SLA'}`,
      ],
      assumptions: ['Outbound customer messages are simulated in Demo Store and require approval before sending.'],
      steps: [
        {
          id: `${planId}-s1`,
          title: 'Prepare policy-grounded draft reply',
          description: 'Save editable draft on the conversation thread without sending.',
          classification: 'draft',
          requiresApproval: false,
          status: 'completed',
          affectedRecords: targetConv ? [targetConv.id, targetConv.customerName] : [],
          externalMessageText: draftText,
          resultDetail: 'Draft saved for merchant review.',
          actionType: 'draft_customer_reply',
          payload: { conversationId: targetConv?.id, draftText },
        },
        {
          id: `${planId}-s2`,
          title: `Send reply to ${targetConv?.customerName ?? 'customer'} (Simulated)`,
          description: 'Requires owner review before transmitting customer-facing message.',
          classification: 'consequential_external',
          requiresApproval: sendEval.decision === 'needs_approval',
          status: sendEval.decision === 'needs_approval' ? 'needs_approval' : 'simulated',
          affectedRecords: targetConv ? [targetConv.customerName, targetConv.orderNumber ?? ''] : [],
          oldValues: { status: targetConv?.status ?? 'open', lastMessageSender: 'customer' },
          newValues: { status: 'waiting', simulatedSend: true },
          externalMessageText: draftText,
          riskNote: 'Customer-facing communication. Simulated in Demo Store—no real email is sent.',
          actionType: 'send_customer_reply',
          payload: { conversationId: targetConv?.id, messageText: draftText, isPolicyFaqOnly: false },
        },
      ],
      createdAt: nowIso,
    };
  }

  // 5. Prepare a discount / promotion
  if (q.includes('discount') || q.includes('promotion') || q.includes('promo')) {
    const hasPercent = q.match(/(\d+)\s*%/);
    const hasFixed = q.match(/\$\s*(\d+)/);
    const discountValue = hasPercent ? Number(hasPercent[1]) : hasFixed ? Number(hasFixed[1]) : null;

    if (!discountValue) {
      return {
        id: planId,
        requestText,
        understanding: 'Prepare a promotional discount draft without activating it yet.',
        retrievedContext: [`Catalog: ${state.products.length} products`, `Policy: ${state.store.policies.find((p) => p.category === 'pricing')?.summary}`],
        assumptions: ['Promotions stay in Draft until reviewed and approved.'],
        clarificationQuestion:
          'What discount amount (e.g., 15% off or $20 off) and which target products or categories should I include in this draft promotion?',
        steps: [],
        createdAt: nowIso,
      };
    }

    const discountType = hasPercent ? 'percentage' : 'fixed_amount';
    const targetProducts = state.products.filter((p) => p.status === 'published').slice(0, 2);
    return {
      id: planId,
      requestText,
      understanding: `Prepare a ${discountType === 'percentage' ? `${discountValue}%` : `$${discountValue}`} draft promotion without applying it.`,
      retrievedContext: [`Matched sample products: ${targetProducts.map((p) => p.title).join(', ')}`],
      assumptions: ['Prepared strictly as a Draft; activation remains gated by store promotion approval rules.'],
      steps: [
        {
          id: `${planId}-s1`,
          title: 'Create Draft Promotion (not applied)',
          description: 'Saves promotion rules and calculates affected products without activating.',
          classification: 'draft',
          requiresApproval: false,
          status: 'completed',
          affectedRecords: targetProducts.map((p) => p.title),
          resultDetail: `Draft promotion prepared for ${targetProducts.length} products (${discountType === 'percentage' ? `${discountValue}% off` : `$${discountValue} off`}). Not active.`,
          actionType: 'prepare_promotion',
          payload: {
            name: `Operator Draft ${discountType === 'percentage' ? `${discountValue}% Off` : `$${discountValue} Off`}`,
            code: `DRAFT${discountValue}`,
            discountType,
            discountValue,
            targetProductIds: targetProducts.map((p) => p.id),
          },
        },
      ],
      createdAt: nowIso,
    };
  }

  // 6. Create draft listings from photos / spreadsheet
  if (q.includes('draft listing') || q.includes('product photo') || q.includes('spreadsheet') || attachments.length > 0) {
    const csvAttachment = attachments.find((a) => a.name.toLowerCase().endsWith('.csv') || a.mimeType.includes('csv') || a.mimeType.includes('text'));
    const imageAttachment = attachments.find((a) => a.mimeType.startsWith('image/'));

    if (attachments.length === 0) {
      return {
        id: planId,
        requestText,
        understanding: 'Extract known product details from uploaded photos or spreadsheets and create editable Draft listings.',
        retrievedContext: [`Catalog categories supported: ${Object.keys(CATEGORY_ATTRIBUTE_TEMPLATES).join(', ')}`],
        assumptions: ['AIRA never invents prices, SKUs, or materials when files are not supplied.'],
        clarificationQuestion:
          'Please attach at least one product photo, CSV spreadsheet, or product spec sheet above so I can extract only verified details into a draft listing.',
        steps: [],
        createdAt: nowIso,
      };
    }

    return {
      id: planId,
      requestText,
      understanding: `Inspect ${attachments.length} uploaded file(s) (${attachments.map((a) => a.name).join(', ')}) and create editable Draft product listing(s).`,
      retrievedContext: [
        csvAttachment ? `Spreadsheet detected: ${csvAttachment.name}` : 'No CSV attached',
        imageAttachment ? `Product image detected: ${imageAttachment.name}` : 'No product image attached',
      ],
      assumptions: ['Uncertain or missing fields (price, SKU, unit cost) are flagged for review rather than guessed.'],
      steps: [
        {
          id: `${planId}-s1`,
          title: 'Create editable Draft listing from verified file details',
          description: 'Saves product in Draft status without publishing to storefront.',
          classification: 'draft',
          requiresApproval: false,
          status: 'completed',
          affectedRecords: [attachments[0].name],
          missingInformation: csvAttachment ? [] : ['SKU, Price, and Stock quantity require manual entry if not present in the file.'],
          resultDetail: 'Draft listing prepared for catalog review.',
          actionType: 'create_product_draft',
          payload: {
            attachmentName: attachments[0].name,
            previewUrl: imageAttachment?.previewUrl,
            textContent: csvAttachment?.textContent,
          },
        },
      ],
      createdAt: nowIso,
    };
  }

  // 7. Refund safety check
  if (q.includes('refund')) {
    return {
      id: planId,
      requestText,
      understanding: 'Evaluate refund request against store safety permissions.',
      retrievedContext: ['Approval Rules: allowRefundExecution = false', 'Connector: DEMO STORE — NOT CONNECTED'],
      assumptions: ['Refund execution cannot run in Demo Store mode.'],
      steps: [
        {
          id: `${planId}-s1`,
          title: 'Execute payment refund',
          description: 'Attempt to trigger refund execution.',
          classification: 'consequential_external',
          requiresApproval: true,
          status: 'blocked',
          blockedReason:
            'Blocked by store safety rules and Demo Store boundary: real payment refunds cannot occur without an authorized live payment/store connector.',
          affectedRecords: [],
          actionType: 'issue_refund_blocked',
        },
      ],
      createdAt: nowIso,
    };
  }

  // Fallback focused clarification
  return {
    id: planId,
    requestText,
    understanding: `Reviewing request against ${state.store.name} catalog (${state.products.length} products) and ${state.orders.length} demo orders.`,
    retrievedContext: [
      `Active products: ${state.products.length}`,
      `Demo orders: ${state.orders.length}`,
      `Open inbox threads: ${state.conversations.filter((c) => c.status !== 'resolved').length}`,
    ],
    assumptions: ['Only verified demo store records and policies are referenced.'],
    clarificationQuestion:
      'Which specific area should I act on—unshipped orders, low-stock inventory, drafting a customer reply, preparing a promotion, or summarizing store performance?',
    steps: [],
    createdAt: nowIso,
  };
}
