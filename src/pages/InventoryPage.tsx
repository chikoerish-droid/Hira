import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpDown, ClipboardCheck, Search } from 'lucide-react';
import { useStoreState } from '../store/useStoreState';
import { formatDateTime } from '../utils/formatters';
import { StatusTag } from '../components/shared/StatusBadge';

interface InventoryPageProps {
  initialFilterHint?: string;
  onOpenApprovals: () => void;
}

export function InventoryPage({ initialFilterHint, onOpenApprovals }: InventoryPageProps) {
  const { state, adjustInventoryStock, logActivity } = useStoreState();

  const [search, setSearch] = useState(
    initialFilterHint && initialFilterHint !== 'low_stock' ? initialFilterHint : ''
  );
  const [lowStockOnly, setLowStockOnly] = useState(initialFilterHint === 'low_stock');
  const [selectedSku, setSelectedSku] = useState<{
    productId: string;
    variantId: string;
    sku: string;
    title: string;
    variantTitle: string;
    stock: number;
  } | null>(null);
  const [deltaInput, setDeltaInput] = useState('10');
  const [reasonInput, setReasonInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilterHint === 'low_stock') {
      setLowStockOnly(true);
    } else if (initialFilterHint) {
      setSearch(initialFilterHint);
    }
  }, [initialFilterHint]);

  const rows = state.products.flatMap((p) =>
    p.variants.map((v) => {
      const available = p.requiresShipping ? v.stock - v.reserved : v.stock;
      const isLow = p.requiresShipping && available <= v.lowStockThreshold;
      return { product: p, variant: v, available, isLow };
    })
  );

  const filteredRows = rows.filter((r) => {
    if (lowStockOnly && !r.isLow) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !r.variant.sku.toLowerCase().includes(q) &&
        !r.product.title.toLowerCase().includes(q) &&
        !r.variant.title.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const replenishmentCandidates = rows.filter((r) => r.isLow);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku) return;
    setErrorMsg(null);
    const delta = Number(deltaInput);
    if (!Number.isFinite(delta) || delta === 0) {
      setErrorMsg('Enter a non-zero quantity change (e.g., +10 or -2).');
      return;
    }
    if (!reasonInput.trim()) {
      setErrorMsg('A reason is mandatory for every stock adjustment.');
      return;
    }
    const res = await adjustInventoryStock(
      selectedSku.productId,
      selectedSku.variantId,
      delta,
      reasonInput.trim()
    );
    if (!res.ok) {
      setErrorMsg(res.message);
      return;
    }
    setNotice(res.message);
    setSelectedSku(null);
    setReasonInput('');
    if (res.needsApproval) {
      onOpenApprovals();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Inventory &amp; Stock Movements</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track on-hand, reserved, and available stock per SKU. Every adjustment requires an explicit reason.
        </p>
      </div>

      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU or product title..."
            className="w-full rounded border border-slate-300 pl-9 pr-3 py-1.5 text-sm"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 px-2">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low-stock alerts only ({replenishmentCandidates.length})
        </label>
      </div>

      {/* Stock Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4">Product &amp; Variant</th>
              <th className="py-3 px-4">Attributes</th>
              <th className="py-3 px-4 text-right">On Hand</th>
              <th className="py-3 px-4 text-right">Reserved</th>
              <th className="py-3 px-4 text-right">Available</th>
              <th className="py-3 px-4 text-right">Threshold</th>
              <th className="py-3 px-4">State</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {filteredRows.map(({ product, variant, available, isLow }) => (
              <tr key={variant.id} className="hover:bg-slate-50/70">
                <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                  {variant.sku}
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium text-slate-900">{product.title}</p>
                  <p className="text-xs text-slate-500">{variant.title}</p>
                </td>
                <td className="py-3 px-4 text-xs text-slate-600">
                  {Object.entries(variant.attributes)
                    .slice(0, 2)
                    .map(([k, val]) => `${k}: ${val}`)
                    .join(' · ') || '—'}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums">{product.requiresShipping ? variant.stock : '∞'}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">{variant.reserved}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                  {product.requiresShipping ? available : 'Unlimited'}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                  {product.requiresShipping ? variant.lowStockThreshold : '—'}
                </td>
                <td className="py-3 px-4">
                  {isLow ? (
                    <StatusTag tone="warning" label="Low Stock" showIcon />
                  ) : (
                    <StatusTag tone="success" label="Healthy" />
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {product.requiresShipping ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSku({
                          productId: product.id,
                          variantId: variant.id,
                          sku: variant.sku,
                          title: product.title,
                          variantTitle: variant.title,
                          stock: variant.stock,
                        });
                        setErrorMsg(null);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <ArrowUpDown className="h-3 w-3" />
                      Adjust
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Digital</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Replenishment Suggestions (never auto-orders PO) */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Replenishment Suggestions (Advisory Only)</h2>
            <p className="text-xs text-slate-500">
              Calculated from low-stock thresholds. AIRA never places supplier purchase orders without explicit approval.
            </p>
          </div>
          {replenishmentCandidates.length > 0 && (
            <button
              type="button"
              onClick={() => {
                logActivity({
                  actor: 'Merchant User',
                  actionSummary: `Saved replenishment suggestion draft for ${replenishmentCandidates.length} low-stock SKU(s) (no PO placed)`,
                  targetRecords: replenishmentCandidates.map((c) => c.variant.sku),
                  classification: 'draft',
                  result: 'simulated',
                  approvalDecision: 'auto_permitted',
                  isSimulated: true,
                });
                setNotice('Saved replenishment suggestion checklist to Activity Log. No supplier PO was placed.');
              }}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Save Replenishment Checklist (Draft)
            </button>
          )}
        </div>

        {replenishmentCandidates.length === 0 ? (
          <p className="text-xs text-slate-500">All tracked physical SKUs are currently above low-stock thresholds.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {replenishmentCandidates.map(({ product, variant, available }) => {
              const suggestedQty = Math.max(10, variant.lowStockThreshold * 3 - available);
              return (
                <div key={variant.id} className="rounded border border-amber-200 bg-amber-50/50 p-3 text-xs flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      <span className="font-mono">{variant.sku}</span> · {product.title}
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      Available: {available} (threshold {variant.lowStockThreshold})
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <span className="font-semibold text-amber-900">Suggest +{suggestedQty}</span>
                    <p className="text-[11px] text-slate-500">Needs approval</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Movement History */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Inventory Movement History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">SKU</th>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4 text-right">Change</th>
                <th className="py-2.5 px-4 text-right">Stock After</th>
                <th className="py-2.5 px-4">Reason</th>
                <th className="py-2.5 px-4">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {state.inventoryEvents.map((ev) => (
                <tr key={ev.id}>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDateTime(ev.timestamp, state.store.dateFormat, state.store.timezone)}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{ev.sku}</td>
                  <td className="py-2.5 px-4 text-slate-800">{ev.productTitle}</td>
                  <td className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${ev.delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {ev.delta >= 0 ? `+${ev.delta}` : ev.delta}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">{ev.newStock}</td>
                  <td className="py-2.5 px-4 text-slate-700">{ev.reason}</td>
                  <td className="py-2.5 px-4 text-slate-500">{ev.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Stock Adjustment Modal */}
      {selectedSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleAdjustSubmit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Adjust Stock: <span className="font-mono">{selectedSku.sku}</span>
            </h3>
            <p className="text-xs text-slate-600">
              {selectedSku.title} ({selectedSku.variantTitle}) · Current on hand:{' '}
              <span className="font-mono font-semibold">{selectedSku.stock}</span>
            </p>

            {errorMsg && (
              <div className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quantity Delta (e.g. +10 or -3)</label>
              <input
                type="number"
                value={deltaInput}
                onChange={(e) => setDeltaInput(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Adjustments of ±25 or more automatically route through the Approval Queue.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mandatory Reason *</label>
              <input
                required
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="e.g., Restock shipment received, Cycle count, Damaged packaging"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setSelectedSku(null)} className="rounded border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700">
                Cancel
              </button>
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
                Save Adjustment (Demo)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
