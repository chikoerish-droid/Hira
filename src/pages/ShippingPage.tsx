import { useState } from 'react';
import { Truck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStoreState } from '../store/useStoreState';
import type { Shipment } from '../types/domain';
import { formatDateTime } from '../utils/formatters';
import { StatusTag } from '../components/shared/StatusBadge';

interface ShippingPageProps {
  initialFilterHint?: string;
  onOpenApprovals: () => void;
}

export function ShippingPage({ initialFilterHint, onOpenApprovals }: ShippingPageProps) {
  const { state, requestPrepareShipment, markShipmentDeliveredDemo } = useStoreState();

  const [tab, setTab] = useState<'all' | 'awaiting' | 'shipped' | 'delayed'>(
    initialFilterHint === 'delayed' ? 'delayed' : 'all'
  );
  const [preparingShip, setPreparingShip] = useState<Shipment | null>(null);
  const [carrier, setCarrier] = useState('UPS (Demo)');
  const [service, setService] = useState('Standard Ground');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = state.shipments.filter((s) => {
    if (tab === 'awaiting') return s.trackingState === 'awaiting_fulfillment' || s.trackingState === 'label_prepared_demo';
    if (tab === 'shipped') return s.trackingState === 'in_transit_demo' || s.trackingState === 'delivered_demo';
    if (tab === 'delayed') return s.delayed || s.trackingState === 'delayed';
    return true;
  });

  const handleOpenPrepare = (ship: Shipment) => {
    setPreparingShip(ship);
    setCarrier(ship.carrier === 'Unassigned' ? 'UPS (Demo)' : ship.carrier);
    setService(ship.service.replace(' (Pending)', ''));
    setTrackingNumber(ship.trackingNumber || `DEMO-UPS-${Math.floor(100000 + Math.random() * 900000)}`);
    setErrorMsg(null);
  };

  const handlePrepareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preparingShip) return;
    const res = await requestPrepareShipment(preparingShip.orderId, carrier, service, trackingNumber);
    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }
    setNotice(res.message);
    setPreparingShip(null);
    if (res.needsApproval) {
      onOpenApprovals();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Shipping &amp; Fulfillment</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage fulfillment queues, delayed shipments, and demo tracking entries. Never marks an order shipped by guessing.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
          {([
            ['all', 'All'],
            ['awaiting', 'Awaiting Fulfillment'],
            ['shipped', 'Shipped'],
            ['delayed', 'Delayed'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                tab === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              <th className="py-3 px-4">Order</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Carrier &amp; Service</th>
              <th className="py-3 px-4">Tracking</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Delay / SLA Note</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/70">
                <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">{s.orderNumber}</td>
                <td className="py-3 px-4 text-slate-800">{s.customerName}</td>
                <td className="py-3 px-4 text-xs text-slate-700">
                  <div className="font-medium text-slate-900">{s.carrier}</div>
                  <div>{s.service}</div>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-slate-700">
                  {s.trackingNumber || <span className="text-slate-400">Not assigned</span>}
                </td>
                <td className="py-3 px-4">
                  <StatusTag
                    tone={
                      s.trackingState === 'delivered_demo'
                        ? 'success'
                        : s.delayed || s.trackingState === 'delayed'
                        ? 'danger'
                        : s.trackingState === 'awaiting_fulfillment'
                        ? 'warning'
                        : 'info'
                    }
                    label={s.trackingState.replace(/_/g, ' ')}
                  />
                </td>
                <td className="py-3 px-4 text-xs">
                  {s.delayReason ? (
                    <span className="inline-flex items-center gap-1 text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {s.delayReason}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-mono tabular-nums">
                      Created {formatDateTime(s.createdAt, state.store.dateFormat, state.store.timezone)}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {s.trackingState === 'awaiting_fulfillment' || s.trackingState === 'label_prepared_demo' ? (
                    <button
                      type="button"
                      onClick={() => handleOpenPrepare(s)}
                      className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      Prepare Shipment
                    </button>
                  ) : s.trackingState === 'in_transit_demo' || s.trackingState === 'delayed' ? (
                    <button
                      type="button"
                      onClick={() => {
                        markShipmentDeliveredDemo(s.id);
                        setNotice(`SIMULATED: Marked ${s.orderNumber} delivered in Demo Store.`);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                      Mark Delivered (Demo)
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Completed</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                  No shipments match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Prepare Shipment Modal */}
      {preparingShip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handlePrepareSubmit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Prepare Demo Shipment · <span className="font-mono">{preparingShip.orderNumber}</span>
            </h3>
            <p className="text-xs text-slate-600">
              Demo simulation only: enter verified carrier and tracking details. Live stores pull carrier labels directly from connected shipping APIs.
            </p>
            {errorMsg && <p className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">{errorMsg}</p>}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Carrier</label>
              <input required value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Service Level</label>
              <input required value={service} onChange={(e) => setService(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tracking Number</label>
              <input required value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPreparingShip(null)} className="rounded border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700">
                Cancel
              </button>
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
                Submit for Approval (Demo)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
