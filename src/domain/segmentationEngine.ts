import type { Customer, CustomerSegmentRule, Order, Product, ProductCategory } from '../types/domain';

export interface CustomerComputedProfile {
  customer: Customer;
  computedOrderCount: number;
  computedTotalSpent: number;
  averageOrderValue: number;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  purchasedCategories: ProductCategory[];
  orderNumbers: string[];
}

const REFERENCE_NOW_MS = new Date('2026-11-19T23:59:59Z').getTime();

export function computeCustomerProfiles(
  customers: Customer[],
  orders: Order[],
  products: Product[]
): CustomerComputedProfile[] {
  return customers.map((customer) => {
    const customerOrders = orders.filter(
      (o) => o.customerId === customer.id && o.fulfillmentStatus !== 'cancelled'
    );
    const paidOrders = customerOrders.filter(
      (o) => o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded'
    );

    const computedOrderCount = customerOrders.length;
    const computedTotalSpent = Number(
      paidOrders.reduce((sum, o) => sum + o.totalAmount, 0).toFixed(2)
    );
    const averageOrderValue =
      paidOrders.length > 0 ? Number((computedTotalSpent / paidOrders.length).toFixed(2)) : 0;

    const sortedDates = customerOrders
      .map((o) => o.createdAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    const lastOrderAt = sortedDates[0] ?? null;
    const daysSinceLastOrder = lastOrderAt
      ? Math.max(0, Math.floor((REFERENCE_NOW_MS - new Date(lastOrderAt).getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const categorySet = new Set<ProductCategory>();
    for (const ord of customerOrders) {
      for (const li of ord.lineItems) {
        const prod = products.find((p) => p.id === li.productId);
        if (prod) categorySet.add(prod.category);
      }
    }

    return {
      customer,
      computedOrderCount,
      computedTotalSpent,
      averageOrderValue,
      lastOrderAt,
      daysSinceLastOrder,
      purchasedCategories: Array.from(categorySet),
      orderNumbers: customerOrders.map((o) => o.orderNumber),
    };
  });
}

export function evaluateSegmentMembers(
  rule: CustomerSegmentRule,
  profiles: CustomerComputedProfile[]
): CustomerComputedProfile[] {
  return profiles.filter((p) => {
    if (p.computedTotalSpent < rule.minTotalSpent) return false;
    if (p.computedOrderCount < rule.minOrderCount) return false;
    if (rule.categoryFilter !== 'All' && !p.purchasedCategories.includes(rule.categoryFilter)) {
      return false;
    }
    if (rule.recencyMode === 'within_days') {
      if (p.daysSinceLastOrder === null || p.daysSinceLastOrder > rule.recencyDays) return false;
    } else if (rule.recencyMode === 'older_than_days') {
      if (p.daysSinceLastOrder === null || p.daysSinceLastOrder <= rule.recencyDays) return false;
    }
    return true;
  });
}
