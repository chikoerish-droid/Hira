import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { computeAnalyticsSummary, type AnalyticsRange } from '../domain/analyticsEngine';
import { useStoreState } from '../store/useStoreState';
import { formatCurrency } from '../utils/formatters';
import { StatusTag } from '../components/shared/StatusBadge';

export function AnalyticsPage() {
  const { state } = useStoreState();
  const [range, setRange] = useState<AnalyticsRange>('30d');

  const summary = computeAnalyticsSummary(
    state.orders,
    state.products,
    state.returns,
    state.shipments,
    state.inventoryEvents,
    state.store,
    range
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analytics &amp; Financial Breakdown</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gross sales, net sales, fees, and cost coverage computed strictly from demo records. Unknown costs never produce fabricated profit.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
          {([
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['90d', '90 days'],
            ['all', 'All demo data'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                range === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cost Data Integrity Banner */}
      {!summary.hasCompleteCostData && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5 text-xs text-amber-950 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Not enough cost data to calculate reliable profit</p>
            <p className="mt-0.5">
              Verified unit cost is available for <span className="font-mono font-semibold">{summary.itemsWithKnownCostCount}</span> of{' '}
              <span className="font-mono font-semibold">{summary.itemsSoldCount}</span> sold units in this range (e.g., digital licenses or refill SKUs with unknown unit cost). Profit metrics are intentionally withheld rather than fabricated.
            </p>
          </div>
        </div>
      )}

      {/* Primary Financial Ledger Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Gross Sales</p>
          <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {formatCurrency(summary.grossSales, state.store.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Before {formatCurrency(summary.discounts, state.store.currency)} discounts
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Net Sales</p>
          <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {formatCurrency(summary.netSales, state.store.currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.paidOrderCount} paid orders · AOV {formatCurrency(summary.averageOrderValue, state.store.currency)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Est. Platform Fees &amp; Known COGS</p>
          <p className="mt-2 text-xl font-semibold font-mono tabular-nums text-slate-900">
            {summary.estimatedPlatformFees !== null
              ? formatCurrency(summary.estimatedPlatformFees, state.store.currency)
              : 'Rate unset'}{' '}
            <span className="text-xs font-normal text-slate-500">fees</span>
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-600">
            Known COGS ({summary.itemsWithKnownCostCount}/{summary.itemsSoldCount} units):{' '}
            {formatCurrency(summary.knownCogsTotal, state.store.currency)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Net Profit</p>
          {summary.netProfitAfterFees !== null ? (
            <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-emerald-800">
              {formatCurrency(summary.netProfitAfterFees, state.store.currency)}
            </p>
          ) : (
            <p className="mt-2 text-base font-semibold text-amber-800">Not enough cost data</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {summary.hasCompleteCostData ? '100% unit cost coverage' : 'Requires unit cost on all sold SKUs'}
          </p>
        </div>
      </div>

      {/* Operational Health Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Orders in Range</p>
          <p className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">{summary.orderCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Cancellations</p>
          <p className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">{summary.cancelledCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Return Requests</p>
          <p className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">
            {summary.returnRequestsCount}{' '}
            <span className="text-xs font-normal text-slate-500">
              ({formatCurrency(summary.returnRequestedValue, state.store.currency)})
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Fulfillment Delays</p>
          <p className="mt-1 text-lg font-semibold font-mono tabular-nums text-amber-800">{summary.delayedShipmentsCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Inventory Movements</p>
          <p className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">{summary.inventoryMovementsCount}</p>
        </div>
      </div>

      {/* Best Sellers Table */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Best Sellers by Revenue ({range})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4 text-right">Units Sold</th>
                <th className="py-3 px-4 text-right">Gross Revenue</th>
                <th className="py-3 px-4">Cost Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {summary.bestSellers.map((b) => (
                <tr key={b.productId}>
                  <td className="py-3 px-4 font-medium text-slate-900">{b.title}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600">{b.sku}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{b.unitsSold}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                    {formatCurrency(b.grossRevenue, state.store.currency)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusTag
                      tone={b.knownCostCoverage === 'Cost data complete' ? 'success' : 'warning'}
                      label={b.knownCostCoverage}
                    />
                  </td>
                </tr>
              ))}
              {summary.bestSellers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                    No paid orders in the selected time range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
