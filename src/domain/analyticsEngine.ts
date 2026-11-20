import type { InventoryEvent, Order, Product, ReturnRequest, Shipment, Store } from '../types/domain';

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

export interface AnalyticsSummary {
  range: AnalyticsRange;
  orderCount: number;
  paidOrderCount: number;
  cancelledCount: number;
  refundedCount: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  shippingCollected: number;
  taxCollected: number;
  estimatedPlatformFees: number | null;
  knownCogsTotal: number;
  itemsSoldCount: number;
  itemsWithKnownCostCount: number;
  hasCompleteCostData: boolean;
  /** Strictly null when cost data is missing for any sold item in range */
  grossProfit: number | null;
  netProfitAfterFees: number | null;
  averageOrderValue: number;
  returnRequestsCount: number;
  returnRequestedValue: number;
  delayedShipmentsCount: number;
  inventoryMovementsCount: number;
  bestSellers: Array<{
    productId: string;
    sku: string;
    title: string;
    unitsSold: number;
    grossRevenue: number;
    knownCostCoverage: string;
  }>;
}

const REFERENCE_NOW_MS = new Date('2026-11-19T23:59:59Z').getTime();

export function filterOrdersByRange(orders: Order[], range: AnalyticsRange): Order[] {
  if (range === 'all') return orders;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const cutoff = REFERENCE_NOW_MS - days * 24 * 60 * 60 * 1000;
  return orders.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
}

export function computeAnalyticsSummary(
  orders: Order[],
  products: Product[],
  returns: ReturnRequest[],
  shipments: Shipment[],
  inventoryEvents: InventoryEvent[],
  store: Store,
  range: AnalyticsRange
): AnalyticsSummary {
  const scopedOrders = filterOrdersByRange(orders, range);
  const nonCancelledPaid = scopedOrders.filter(
    (o) => o.fulfillmentStatus !== 'cancelled' && (o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded')
  );
  const cancelledCount = scopedOrders.filter((o) => o.fulfillmentStatus === 'cancelled').length;
  const refundedCount = scopedOrders.filter((o) => o.paymentStatus === 'refunded' || o.paymentStatus === 'partially_refunded').length;

  let grossSales = 0;
  let discounts = 0;
  let shippingCollected = 0;
  let taxCollected = 0;
  let knownCogsTotal = 0;
  let itemsSoldCount = 0;
  let itemsWithKnownCostCount = 0;

  const productAgg = new Map<
    string,
    { productId: string; sku: string; title: string; unitsSold: number; grossRevenue: number; knownItems: number; totalItems: number }
  >();

  for (const order of nonCancelledPaid) {
    grossSales += order.subtotal;
    discounts += order.discountTotal;
    shippingCollected += order.shippingTotal;
    taxCollected += order.taxTotal;

    for (const item of order.lineItems) {
      itemsSoldCount += item.quantity;
      const product = products.find((p) => p.id === item.productId);
      const variant = product?.variants.find((v) => v.id === item.variantId);
      const resolvedCost = item.unitCost ?? variant?.unitCost ?? null;

      if (resolvedCost !== null) {
        knownCogsTotal += resolvedCost * item.quantity;
        itemsWithKnownCostCount += item.quantity;
      }

      const existing = productAgg.get(item.productId) ?? {
        productId: item.productId,
        sku: item.sku,
        title: item.title,
        unitsSold: 0,
        grossRevenue: 0,
        knownItems: 0,
        totalItems: 0,
      };
      existing.unitsSold += item.quantity;
      existing.grossRevenue += item.unitPrice * item.quantity - item.discountAmount;
      existing.totalItems += item.quantity;
      if (resolvedCost !== null) {
        existing.knownItems += item.quantity;
      }
      productAgg.set(item.productId, existing);
    }
  }

  const netSales = Math.max(0, grossSales - discounts);
  const estimatedPlatformFees =
    store.platformFeeRate !== null ? Number(((netSales + shippingCollected + taxCollected) * store.platformFeeRate).toFixed(2)) : null;

  const hasCompleteCostData = itemsSoldCount > 0 && itemsWithKnownCostCount === itemsSoldCount;
  const grossProfit = hasCompleteCostData ? Number((netSales - knownCogsTotal).toFixed(2)) : null;
  const netProfitAfterFees =
    hasCompleteCostData && estimatedPlatformFees !== null
      ? Number((netSales - knownCogsTotal - estimatedPlatformFees).toFixed(2))
      : null;

  const averageOrderValue = nonCancelledPaid.length > 0 ? Number((netSales / nonCancelledPaid.length).toFixed(2)) : 0;

  const bestSellers = Array.from(productAgg.values())
    .sort((a, b) => b.grossRevenue - a.grossRevenue)
    .map((entry) => ({
      productId: entry.productId,
      sku: entry.sku,
      title: entry.title,
      unitsSold: entry.unitsSold,
      grossRevenue: Number(entry.grossRevenue.toFixed(2)),
      knownCostCoverage:
        entry.knownItems === entry.totalItems
          ? 'Cost data complete'
          : `Missing cost for ${entry.totalItems - entry.knownItems}/${entry.totalItems} units`,
    }));

  const returnRequestedValue = returns.reduce((sum, r) => sum + r.requestedAmount, 0);
  const delayedShipmentsCount = shipments.filter((s) => s.delayed || s.trackingState === 'delayed').length;

  return {
    range,
    orderCount: scopedOrders.length,
    paidOrderCount: nonCancelledPaid.length,
    cancelledCount,
    refundedCount,
    grossSales: Number(grossSales.toFixed(2)),
    discounts: Number(discounts.toFixed(2)),
    netSales: Number(netSales.toFixed(2)),
    shippingCollected: Number(shippingCollected.toFixed(2)),
    taxCollected: Number(taxCollected.toFixed(2)),
    estimatedPlatformFees,
    knownCogsTotal: Number(knownCogsTotal.toFixed(2)),
    itemsSoldCount,
    itemsWithKnownCostCount,
    hasCompleteCostData,
    grossProfit,
    netProfitAfterFees,
    averageOrderValue,
    returnRequestsCount: returns.length,
    returnRequestedValue: Number(returnRequestedValue.toFixed(2)),
    delayedShipmentsCount,
    inventoryMovementsCount: inventoryEvents.length,
    bestSellers,
  };
}

export function isOrderPastSla(order: Order, slaBusinessDays: number): boolean {
  if (order.paymentStatus !== 'paid') return false;
  if (order.fulfillmentStatus !== 'unfulfilled') return false;
  // Check if order is digital-only
  const createdMs = new Date(order.createdAt).getTime();
  const ageDays = (REFERENCE_NOW_MS - createdMs) / (1000 * 60 * 60 * 24);
  return ageDays > slaBusinessDays;
}
