import { useState } from 'react';
import { AlertTriangle, Check, Plus, Tag } from 'lucide-react';
import { useStoreState } from '../store/useStoreState';
import type { Product, ProductCategory, Promotion } from '../types/domain';
import { formatCurrency } from '../utils/formatters';
import { StatusTag } from '../components/shared/StatusBadge';

const CATEGORIES: ProductCategory[] = [
  'Electronics',
  'Home & Kitchen',
  'Beauty & Personal Care',
  'Books & Stationery',
  'Specialty Groceries',
  'Digital Downloads',
  'Subscriptions & Bundles',
  'Made-to-Order Goods',
];

interface PromotionsPageProps {
  onOpenApprovals: () => void;
}

export function PromotionsPage({ onOpenApprovals }: PromotionsPageProps) {
  const { state, savePromotionDraft, requestActivatePromotion } = useStoreState();

  const [selectedPromoId, setSelectedPromoId] = useState<string>(state.promotions[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Builder state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [targetType, setTargetType] = useState<Promotion['targetType']>('products');
  const [targetProductIds, setTargetProductIds] = useState<string[]>(['prod-01']);
  const [targetCategories, setTargetCategories] = useState<ProductCategory[]>(['Electronics']);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [discountType, setDiscountType] = useState<Promotion['discountType']>('percentage');
  const [discountValue, setDiscountValue] = useState('15');
  const [eligibleCustomers, setEligibleCustomers] = useState<Promotion['eligibleCustomers']>('all');
  const [startAt, setStartAt] = useState('2026-11-20T00:00');
  const [endAt, setEndAt] = useState('2026-11-30T23:59');

  const resolveAffectedProducts = (promo: Promotion): Product[] => {
    return state.products.filter((p) => {
      if (p.status === 'archived') return false;
      if (promo.excludedProductIds.includes(p.id)) return false;
      if (promo.targetType === 'entire_catalog') return true;
      if (promo.targetType === 'products') return promo.targetProductIds.includes(p.id);
      return promo.targetCategories.includes(p.category);
    });
  };

  const activePromo = creating
    ? ({
        id: 'preview-draft',
        name: name || 'Untitled Draft Promotion',
        code: code || 'PREVIEW',
        targetType,
        targetProductIds,
        targetCategories,
        excludedProductIds: excludedIds,
        discountType,
        discountValue: Number(discountValue) || 0,
        eligibleCustomers,
        startAt,
        endAt,
        status: 'draft',
        createdAt: new Date().toISOString(),
      } satisfies Promotion)
    : state.promotions.find((p) => p.id === selectedPromoId) ?? state.promotions[0] ?? null;

  const affectedProducts = activePromo ? resolveAffectedProducts(activePromo) : [];

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    const promo: Promotion = {
      id: `promo-${Date.now()}`,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      targetType,
      targetProductIds,
      targetCategories,
      excludedProductIds: excludedIds,
      discountType,
      discountValue: Math.max(0, Number(discountValue) || 0),
      eligibleCustomers,
      startAt,
      endAt,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    savePromotionDraft(promo);
    setSelectedPromoId(promo.id);
    setCreating(false);
    setNotice(`Saved "${promo.name}" (${promo.code}) as Draft. Review before applying.`);
  };

  const handleApplyPromo = async (promoId: string) => {
    const res = await requestActivatePromotion(promoId);
    setNotice(res.message);
    if (res.needsApproval) {
      onOpenApprovals();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Promotions</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure and preview discount impact on exact products before requesting approval to apply in demo mode.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          {creating ? 'Close Builder' : 'New Promotion Draft'}
        </button>
      </div>

      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {creating && (
        <form onSubmit={handleSaveDraft} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Create Promotion Draft (Live Preview Below)</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Promotion Name *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Winter Audio & Desk Bundle" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Promo Code *</label>
              <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="WINTER15" className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono uppercase" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Eligible Customers</label>
              <select value={eligibleCustomers} onChange={(e) => setEligibleCustomers(e.target.value as Promotion['eligibleCustomers'])} className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="all">All customers</option>
                <option value="repeat_only">Repeat customers only</option>
                <option value="first_order">First order only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Discount Type</label>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as Promotion['discountType'])} className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount ({state.store.currency})</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Discount Value</label>
              <input type="number" min="1" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start Date/Time</label>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full rounded border border-slate-300 px-2.5 py-2 text-xs font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">End Date/Time</label>
              <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-full rounded border border-slate-300 px-2.5 py-2 text-xs font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Scope</label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value as Promotion['targetType'])} className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white mb-2">
                <option value="products">Specific Products</option>
                <option value="categories">Specific Categories</option>
                <option value="entire_catalog">Entire Active Catalog</option>
              </select>

              {targetType === 'products' && (
                <div className="max-h-36 overflow-y-auto rounded border border-slate-200 p-2.5 space-y-1 text-xs">
                  {state.products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={targetProductIds.includes(p.id)}
                        onChange={() =>
                          setTargetProductIds((prev) =>
                            prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          )
                        }
                      />
                      <span>{p.title}</span>
                    </label>
                  ))}
                </div>
              )}

              {targetType === 'categories' && (
                <div className="max-h-36 overflow-y-auto rounded border border-slate-200 p-2.5 space-y-1 text-xs">
                  {CATEGORIES.map((c) => (
                    <label key={c} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={targetCategories.includes(c)}
                        onChange={() =>
                          setTargetCategories((prev) =>
                            prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                          )
                        }
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Exclusions (Never Discounted)</label>
              <div className="max-h-44 overflow-y-auto rounded border border-slate-200 p-2.5 space-y-1 text-xs">
                {state.products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={excludedIds.includes(p.id)}
                      onChange={() =>
                        setExcludedIds((prev) =>
                          prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                        )
                      }
                    />
                    <span>{p.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
              Save as Draft (Does Not Apply)
            </button>
          </div>
        </form>
      )}

      {/* Promotions List + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 space-y-2.5">
          {state.promotions.map((promo) => (
            <button
              key={promo.id}
              type="button"
              onClick={() => {
                setCreating(false);
                setSelectedPromoId(promo.id);
              }}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${
                !creating && activePromo?.id === promo.id
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-900">{promo.code}</span>
                <StatusTag
                  tone={promo.status === 'active_demo' ? 'success' : 'warning'}
                  label={promo.status === 'active_demo' ? 'Active (Demo)' : 'Draft'}
                />
              </div>
              <p className="mt-1 text-sm font-medium text-slate-900">{promo.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {promo.discountType === 'percentage'
                  ? `${promo.discountValue}% off`
                  : `${formatCurrency(promo.discountValue, state.store.currency)} off`}{' '}
                · {promo.eligibleCustomers.replace('_', ' ')}
              </p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-8 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          {activePromo ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-blue-600" />
                    <h2 className="text-base font-semibold text-slate-900">
                      {activePromo.name} (<span className="font-mono">{activePromo.code}</span>)
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 font-mono">
                    Window: {activePromo.startAt.replace('T', ' ')} → {activePromo.endAt.replace('T', ' ')} · Eligible:{' '}
                    {activePromo.eligibleCustomers.replace('_', ' ')}
                  </p>
                </div>

                {activePromo.status === 'draft' && activePromo.id !== 'preview-draft' && (
                  <button
                    type="button"
                    onClick={() => handleApplyPromo(activePromo.id)}
                    className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Request Approval to Apply (Demo)
                  </button>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Affected Products &amp; Price Impact Preview ({affectedProducts.length} products)
                </p>
                {affectedProducts.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No active products match the selected target and exclusion rules.</p>
                ) : (
                  <div className="overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                          <th className="py-2.5 px-3">Product</th>
                          <th className="py-2.5 px-3 text-right">Current Price</th>
                          <th className="py-2.5 px-3 text-right">Promo Price</th>
                          <th className="py-2.5 px-3">Margin / Cost Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {affectedProducts.map((p) => {
                          const basePrice = p.variants[0]?.price ?? 0;
                          const cost = p.variants[0]?.unitCost ?? null;
                          const promoPrice =
                            activePromo.discountType === 'percentage'
                              ? Math.max(0, basePrice * (1 - activePromo.discountValue / 100))
                              : Math.max(0, basePrice - activePromo.discountValue);
                          return (
                            <tr key={p.id}>
                              <td className="py-2.5 px-3 font-medium text-slate-900">
                                {p.title}
                                <span className="block text-[11px] text-slate-500">{p.category}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                                {formatCurrency(basePrice, state.store.currency)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-blue-700">
                                {formatCurrency(promoPrice, state.store.currency)}
                              </td>
                              <td className="py-2.5 px-3">
                                {cost === null ? (
                                  <span className="inline-flex items-center gap-1 text-amber-800">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    Unit cost unknown (margin cannot be verified)
                                  </span>
                                ) : (
                                  <span className="font-mono tabular-nums text-slate-700">
                                    Est. unit margin: {formatCurrency(promoPrice - cost, state.store.currency)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Select or create a promotion to preview impact.</p>
          )}
        </div>
      </div>
    </div>
  );
}
