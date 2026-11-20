import { useEffect, useState } from 'react';
import { AlertCircle, Search, X } from 'lucide-react';
import { isOrderPastSla } from '../domain/analyticsEngine';
import { useStoreState } from '../store/useStoreState';
import type { Order } from '../types/domain';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { StatusTag } from '../components/shared/StatusBadge';

interface OrdersPageProps {
  initialFilterHint?: string;
  onOpenApprovals: () => void;
}

export function OrdersPage({ initialFilterHint, onOpenApprovals }: OrdersPageProps) {
  const { state, addOrderNote, toggleOrderException, requestOrderFulfillmentUpdate } = useStoreState();

  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [exceptionOnly, setExceptionOnly] = useState(initialFilterHint === 'attention');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilterHint === 'attention') {
      setExceptionOnly(true);
    } else if (initialFilterHint && initialFilterHint.startsWith('#')) {
      setSearch(initialFilterHint);
      const matched = state.orders.find((o) => o.orderNumber === initialFilterHint);
      if (matched) setSelectedOrderId(matched.id);
    }
  }, [initialFilterHint, state.orders]);

  const filteredOrders = state.orders.filter((o) => {
    if (paymentFilter !== 'all' && o.paymentStatus !== paymentFilter) return false;
    if (fulfillmentFilter !== 'all' && o.fulfillmentStatus !== fulfillmentFilter) return false;
    if (channelFilter !== 'all' && o.channel !== channelFilter) return false;
    if (exceptionOnly && !o.exceptionFlag && !isOrderPastSla(o, state.store.shippingSlaBusinessDays)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = o.orderNumber.toLowerCase().includes(q);
      const matchName = o.customerName.toLowerCase().includes(q);
      const matchSku = o.lineItems.some((li) => li.sku.toLowerCase().includes(q));
      if (!matchNum && !matchName && !matchSku) return false;
    }
    return true;
  });

  const selectedOrder = state.orders.find((o) => o.id === selectedOrderId) ?? null;

  const handleStatusChange = async (order: Order, nextStatus: Order['fulfillmentStatus']) => {
    const res = await requestOrderFulfillmentUpdate(order.id, nextStatus);
    setNotice(res.message);
    if (res.needsApproval) {
      onOpenApprovals();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
        <p className="mt-1 text-sm text-slate-600">
          Inspect demo orders, notes, SLA exceptions, and fulfillment timelines. Status changes respect store approval policies.
        </p>
      </div>

      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900 flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer, or SKU..."
            className="w-full rounded border border-slate-300 pl-9 pr-3 py-1.5 text-sm"
          />
        </div>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">
          <option value="all">All payment states</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={fulfillmentFilter} onChange={(e) => setFulfillmentFilter(e.target.value)} className="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">
          <option value="all">All fulfillment states</option>
          <option value="unfulfilled">Unfulfilled</option>
          <option value="prepared">Prepared</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">
          <option value="all">All channels</option>
          <option value="Web Storefront">Web Storefront</option>
          <option value="Marketplace">Marketplace</option>
          <option value="Subscription Renewal">Subscription Renewal</option>
          <option value="Custom Order">Custom Order</option>
        </select>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 px-2">
          <input type="checkbox" checked={exceptionOnly} onChange={(e) => setExceptionOnly(e.target.checked)} />
          Exceptions / Past SLA only
        </label>
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              <th className="py-3 px-4">Order</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Channel</th>
              <th className="py-3 px-4">Payment</th>
              <th className="py-3 px-4">Fulfillment</th>
              <th className="py-3 px-4">Exception</th>
              <th className="py-3 px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {filteredOrders.map((o) => {
              const pastSla = isOrderPastSla(o, state.store.shippingSlaBusinessDays);
              return (
                <tr
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-700">{o.orderNumber}</td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                    {formatDateTime(o.createdAt, state.store.dateFormat, state.store.timezone)}
                  </td>
                  <td className="py-3 px-4 text-slate-900 font-medium">{o.customerName}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{o.channel}</td>
                  <td className="py-3 px-4">
                    <StatusTag
                      tone={o.paymentStatus === 'paid' ? 'success' : o.paymentStatus === 'refunded' ? 'neutral' : 'warning'}
                      label={o.paymentStatus}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <StatusTag
                      tone={
                        o.fulfillmentStatus === 'delivered'
                          ? 'success'
                          : o.fulfillmentStatus === 'shipped' || o.fulfillmentStatus === 'prepared'
                          ? 'info'
                          : o.fulfillmentStatus === 'cancelled'
                          ? 'neutral'
                          : 'warning'
                      }
                      label={o.fulfillmentStatus}
                    />
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {o.exceptionFlag || pastSla ? (
                      <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{o.exceptionFlag ?? 'Past SLA'}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                    {formatCurrency(o.totalAmount, o.currency)}
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                  No demo orders match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl h-full bg-white border-l border-slate-200 flex flex-col shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 font-mono">{selectedOrder.orderNumber}</h2>
                <p className="text-xs text-slate-500">
                  {selectedOrder.channel} · {formatDateTime(selectedOrder.createdAt, state.store.dateFormat, state.store.timezone)}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedOrderId(null)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Customer & Demo Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded border border-slate-200 p-3.5 text-xs space-y-1">
                  <p className="font-semibold text-slate-900">Customer</p>
                  <p className="text-slate-800">{selectedOrder.customerName}</p>
                  <p className="font-mono text-slate-500">{selectedOrder.customerEmail}</p>
                </div>
                <div className="rounded border border-slate-200 p-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">Shipping Address</p>
                    <StatusTag tone="warning" label="DEMO DATA" />
                  </div>
                  <p className="text-slate-700">{selectedOrder.shippingAddressDemo.recipient}</p>
                  <p className="text-slate-600">{selectedOrder.shippingAddressDemo.line1}</p>
                  <p className="text-slate-600">
                    {selectedOrder.shippingAddressDemo.city}, {selectedOrder.shippingAddressDemo.region}{' '}
                    {selectedOrder.shippingAddressDemo.postalCode}, {selectedOrder.shippingAddressDemo.country}
                  </p>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Line Items</p>
                <div className="rounded border border-slate-200 divide-y divide-slate-200">
                  {selectedOrder.lineItems.map((li) => (
                    <div key={li.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-medium text-slate-900">{li.title}</p>
                        <p className="text-slate-500">
                          {li.variantLabel} · <span className="font-mono">{li.sku}</span> · Qty {li.quantity}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums font-medium text-slate-900">
                        {formatCurrency(li.unitPrice * li.quantity, selectedOrder.currency)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs font-mono tabular-nums text-right text-slate-700 space-y-0.5">
                  <p>Subtotal: {formatCurrency(selectedOrder.subtotal, selectedOrder.currency)}</p>
                  <p>Shipping: {formatCurrency(selectedOrder.shippingTotal, selectedOrder.currency)} · Tax: {formatCurrency(selectedOrder.taxTotal, selectedOrder.currency)}</p>
                  <p className="text-sm font-semibold text-slate-900">
                    Total: {formatCurrency(selectedOrder.totalAmount, selectedOrder.currency)}
                  </p>
                </div>
              </div>

              {/* Approval-Gated Status Update & Exception Controls */}
              <div className="rounded border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-900">Order Operations (Demo Sandbox)</p>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.fulfillmentStatus === 'unfulfilled' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder, 'prepared')}
                      className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Mark Prepared (Requires Approval)
                    </button>
                  )}
                  {selectedOrder.fulfillmentStatus !== 'cancelled' && selectedOrder.fulfillmentStatus !== 'delivered' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder, 'cancelled')}
                      className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Request Cancellation (Demo)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      toggleOrderException(
                        selectedOrder.id,
                        selectedOrder.exceptionFlag ? null : 'Flagged manually for operations review'
                      )
                    }
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {selectedOrder.exceptionFlag ? 'Clear Exception Flag' : 'Flag Exception'}
                  </button>
                </div>
              </div>

              {/* Internal Notes */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">Order Notes</p>
                {selectedOrder.notes.length > 0 && (
                  <ul className="space-y-1.5">
                    {selectedOrder.notes.map((n, idx) => (
                      <li key={idx} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add internal demo order note..."
                    className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addOrderNote(selectedOrder.id, newNote);
                      setNewNote('');
                    }}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                  >
                    Add Note
                  </button>
                </div>
              </div>

              {/* Status Timeline */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Status Timeline</p>
                <div className="space-y-2">
                  {selectedOrder.timeline.map((t) => (
                    <div key={t.id} className="rounded border border-slate-200 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-medium text-slate-800">{t.actor}</span>
                        <span className="font-mono tabular-nums">{formatDateTime(t.timestamp, state.store.dateFormat, state.store.timezone)}</span>
                      </div>
                      <p className="mt-0.5 text-slate-700">{t.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
