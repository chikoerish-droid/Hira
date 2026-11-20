import { useState } from 'react';
import { ArrowRight, AlertCircle, Clock, PackageCheck, RotateCcw } from 'lucide-react';
import type { NavSectionId } from '../config/brand';
import { computeAnalyticsSummary, isOrderPastSla, type AnalyticsRange } from '../domain/analyticsEngine';
import { useStoreState } from '../store/useStoreState';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { OutcomeTag, StatusTag } from '../components/shared/StatusBadge';

interface OverviewPageProps {
  onNavigate: (section: NavSectionId, filterHint?: string) => void;
  onOpenApprovals: () => void;
}

export function OverviewPage({ onNavigate, onOpenApprovals }: OverviewPageProps) {
  const { state, pendingApprovalsCount } = useStoreState();
  const [range, setRange] = useState<AnalyticsRange>('30d');

  const analytics = computeAnalyticsSummary(
    state.orders,
    state.products,
    state.returns,
    state.shipments,
    state.inventoryEvents,
    state.store,
    range
  );

  const attentionOrders = state.orders.filter(
    (o) => Boolean(o.exceptionFlag) || isOrderPastSla(o, state.store.shippingSlaBusinessDays)
  );
  const openConversations = state.conversations.filter((c) => c.status !== 'resolved');
  const delayedShipments = state.shipments.filter((s) => s.delayed || s.trackingState === 'delayed');
  const lowStockVariants = state.products.flatMap((p) =>
    p.variants
      .filter((v) => p.requiresShipping && v.stock - v.reserved <= v.lowStockThreshold)
      .map((v) => ({ product: p, variant: v }))
  );
  const pendingReturns = state.returns.filter(
    (r) => r.status === 'pending_review' || r.status === 'awaiting_evidence'
  );

  const recentRuns = state.automations
    .flatMap((a) => a.runHistory)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Header & Period Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Store Operations Overview</h1>
          <p className="mt-1 text-sm text-slate-600">
            Demo store snapshot for {state.store.name}. Metrics reflect verified demo records only.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setRange(p)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                range === p ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPI Grid — every tile links directly to a filtered view */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('analytics')}
          className="text-left rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500">Demo Net Sales ({range})</p>
          <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {formatCurrency(analytics.netSales, state.store.currency)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {analytics.paidOrderCount} paid order(s) ·{' '}
            {analytics.hasCompleteCostData ? 'Cost data complete' : 'Gross sales only (partial cost data)'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('orders', 'attention')}
          className="text-left rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500">Orders Needing Attention</p>
          <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {attentionOrders.length}
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Includes paid orders past {state.store.shippingSlaBusinessDays}-day SLA
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('customers', 'open')}
          className="text-left rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500">Open &amp; Waiting Conversations</p>
          <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {openConversations.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">Drafts require review before simulated send</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('inventory', 'low_stock')}
          className="text-left rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500">Low-Stock SKUs</p>
          <p className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {lowStockVariants.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {delayedShipments.length} delayed shipments · {pendingReturns.length} pending returns
          </p>
        </button>
      </div>

      {/* Quick Operational Links Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('shipping', 'delayed')}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-sm hover:bg-slate-50"
        >
          <span className="flex items-center gap-2.5 text-slate-800 font-medium">
            <Clock className="h-4 w-4 text-amber-600" />
            Delayed Shipments ({delayedShipments.length})
          </span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('returns', 'pending')}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-sm hover:bg-slate-50"
        >
          <span className="flex items-center gap-2.5 text-slate-800 font-medium">
            <RotateCcw className="h-4 w-4 text-blue-600" />
            Pending Returns ({pendingReturns.length})
          </span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={onOpenApprovals}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-sm hover:bg-slate-50"
        >
          <span className="flex items-center gap-2.5 text-slate-800 font-medium">
            <PackageCheck className="h-4 w-4 text-slate-700" />
            Pending Approvals ({pendingApprovalsCount})
          </span>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* Two-Column Operational Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Prioritized Needs Attention Queue */}
        <section className="lg:col-span-7 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Needs Attention</h2>
            <button
              type="button"
              onClick={() => onNavigate('operator')}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Triage with AI Operator
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {attentionOrders.map((order) => (
              <div key={order.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-900">{order.orderNumber}</span>
                    <span className="text-sm font-medium text-slate-800 truncate">{order.customerName}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{order.exceptionFlag ?? 'Paid order unfulfilled past shipping SLA'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('orders', order.orderNumber)}
                  className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Inspect Order
                </button>
              </div>
            ))}

            {lowStockVariants.slice(0, 2).map(({ product, variant }) => (
              <div key={variant.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-900">{variant.sku}</span>
                    <span className="text-sm font-medium text-slate-800 truncate">{product.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {variant.stock - variant.reserved} available (threshold {variant.lowStockThreshold})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('inventory', variant.sku)}
                  className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Review Stock
                </button>
              </div>
            ))}

            {attentionOrders.length === 0 && lowStockVariants.length === 0 && (
              <p className="px-5 py-8 text-sm text-slate-500 text-center">No urgent exceptions in demo store.</p>
            )}
          </div>
        </section>

        {/* Recent Automation Runs & Activity */}
        <section className="lg:col-span-5 rounded-lg border border-slate-200 bg-white flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Recent Simulated Runs &amp; Activity</h2>
            <button
              type="button"
              onClick={() => onNavigate('activity')}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Full Audit Log
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {recentRuns.map((run) => (
              <div key={run.id} className="px-5 py-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900 truncate">{run.automationName}</span>
                  <StatusTag tone={run.status === 'failed' ? 'danger' : 'info'} label="SIMULATED" />
                </div>
                <p className="text-xs text-slate-600">{run.resultSummary}</p>
                <p className="text-[11px] font-mono tabular-nums text-slate-400">
                  {formatDateTime(run.startedAt, state.store.dateFormat, state.store.timezone)}
                </p>
              </div>
            ))}

            {state.activityLog.slice(0, 3).map((act) => (
              <div key={act.id} className="px-5 py-3.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-800 truncate">{act.actionSummary}</span>
                  <OutcomeTag status={act.result} />
                </div>
                <p className="text-[11px] font-mono tabular-nums text-slate-400">
                  {act.actor} · {formatDateTime(act.timestamp, state.store.dateFormat, state.store.timezone)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
