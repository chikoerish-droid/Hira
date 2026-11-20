import { useState } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { useStoreState } from '../store/useStoreState';
import type { CurrencyCode, DateFormatPreference, WeightUnit } from '../types/domain';

export function SettingsPage() {
  const {
    state,
    updateStoreSettings,
    updateStorePolicy,
    updateApprovalRules,
    updateNotifications,
    resetDemoData,
  } = useStoreState();

  const [storeName, setStoreName] = useState(state.store.name);
  const [currency, setCurrency] = useState<CurrencyCode>(state.store.currency);
  const [timezone, setTimezone] = useState(state.store.timezone);
  const [dateFormat, setDateFormat] = useState<DateFormatPreference>(state.store.dateFormat);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(state.store.weightUnit);
  const [slaDays, setSlaDays] = useState(String(state.store.shippingSlaBusinessDays));
  const [returnDays, setReturnDays] = useState(String(state.store.returnWindowDays));
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rules = state.store.approvalRules;

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateStoreSettings({
      name: storeName.trim() || state.store.name,
      currency,
      timezone,
      dateFormat,
      weightUnit,
      shippingSlaBusinessDays: Math.max(1, Number(slaDays) || 2),
      returnWindowDays: Math.max(1, Number(returnDays) || 30),
    });
    setNotice('Saved demo store settings.');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Store Settings &amp; Governance</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure localization, store policies, action approval rules, and narrow automation switches.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirmResetOpen(true)}
          className="inline-flex items-center gap-1.5 rounded border border-red-300 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Demo Data
        </button>
      </div>

      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {/* General Localization & SLA */}
      <form onSubmit={handleSaveGeneral} className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Store Profile, Locale &amp; Operational SLAs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Store Name</label>
            <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white">
              {(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'] as const).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white">
              <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
              <option value="America/New_York">America/New_York (ET)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Europe/Berlin">Europe/Berlin (CET)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date Format</label>
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormatPreference)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white">
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Weight Unit</label>
            <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as WeightUnit)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white">
              <option value="g">Grams (g)</option>
              <option value="kg">Kilograms (kg)</option>
              <option value="oz">Ounces (oz)</option>
              <option value="lb">Pounds (lb)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Shipping SLA (days)</label>
              <input type="number" min="1" value={slaDays} onChange={(e) => setSlaDays(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Return Window (days)</label>
              <input type="number" min="1" value={returnDays} onChange={(e) => setReturnDays(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono" />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
            Save Store Settings
          </button>
        </div>
      </form>

      {/* Action Approval & Narrow Auto-Approval Rules */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Action Permissions &amp; Approval Rules</h2>
          <p className="mt-1 text-xs text-slate-500">
            Read-only queries and drafts run immediately by default. Consequential mutations require explicit review. Narrow auto-approval rules cannot bypass hard-blocked sensitive actions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <label className="flex items-start gap-2.5 rounded border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={rules.requireApprovalToPublishProduct}
              onChange={(e) =>
                updateApprovalRules({ ...rules, requireApprovalToPublishProduct: e.target.checked })
              }
            />
            <span>
              <strong className="block text-slate-900">Require approval to publish products</strong>
              <span className="text-slate-600">New and edited listings save as Draft until approved.</span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 rounded border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={rules.requireApprovalToSendCustomerMessage}
              onChange={(e) =>
                updateApprovalRules({ ...rules, requireApprovalToSendCustomerMessage: e.target.checked })
              }
            />
            <span>
              <strong className="block text-slate-900">Require approval before sending customer replies</strong>
              <span className="text-slate-600">Drafts are held for review before simulated dispatch.</span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 rounded border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={rules.requireApprovalForFulfillmentOrCancel}
              onChange={(e) =>
                updateApprovalRules({ ...rules, requireApprovalForFulfillmentOrCancel: e.target.checked })
              }
            />
            <span>
              <strong className="block text-slate-900">Require approval for fulfillment / cancellations</strong>
              <span className="text-slate-600">Gates shipment creation and order status updates.</span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 rounded border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={rules.requireApprovalToLaunchPromotion}
              onChange={(e) =>
                updateApprovalRules({ ...rules, requireApprovalToLaunchPromotion: e.target.checked })
              }
            />
            <span>
              <strong className="block text-slate-900">Require approval to launch promotions</strong>
              <span className="text-slate-600">Promotions save as Draft with impact preview first.</span>
            </span>
          </label>
        </div>

        {/* Narrow Rule-Based Auto-Approval */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-900">Narrow Rule-Based Auto-Approval</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <label className="flex items-start gap-2.5 rounded border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={rules.narrowRules.autoReplyPolicyFaqOnly}
                onChange={(e) =>
                  updateApprovalRules({
                    ...rules,
                    narrowRules: { ...rules.narrowRules, autoReplyPolicyFaqOnly: e.target.checked },
                  })
                }
              />
              <span>
                <strong className="block text-slate-900">Auto-send Policy-Only FAQ Replies (Simulated)</strong>
                <span className="text-slate-600">
                  Permits auto-reply ONLY for verified policy FAQs (limit {rules.narrowRules.autoReplyMaxOrdersPerRun} per run). Never applies to refunds or exceptions.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 rounded border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={rules.narrowRules.autoFlagDelayedShipments}
                onChange={(e) =>
                  updateApprovalRules({
                    ...rules,
                    narrowRules: { ...rules.narrowRules, autoFlagDelayedShipments: e.target.checked },
                  })
                }
              />
              <span>
                <strong className="block text-slate-900">Auto-flag Orders Past Shipping SLA</strong>
                <span className="text-slate-600">
                  Flags paid unfulfilled orders exceeding {rules.narrowRules.delayedShipmentThresholdBusinessDays} business days.
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Hard-Blocked Sensitive Actions */}
        <div className="rounded border border-red-200 bg-red-50 p-4 text-xs text-red-900 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Hard-Blocked Actions in Demo Store</p>
            <p className="mt-0.5">
              Payment refunds, payout transfers, and account security modifications are permanently blocked in Demo Store mode and cannot be unlocked by any broad automation switch.
            </p>
          </div>
        </div>
      </section>

      {/* Store Policies */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Approved Store Policies (Used to Ground AI Replies)</h2>
        <div className="space-y-3">
          {state.store.policies.map((pol) => (
            <div key={pol.id} className="rounded border border-slate-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">{pol.title}</span>
                <span className="text-[11px] font-mono text-slate-500">{pol.category}</span>
              </div>
              <textarea
                rows={2}
                value={pol.fullText}
                onChange={(e) =>
                  updateStorePolicy({
                    ...pol,
                    fullText: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="w-full rounded border border-slate-300 p-2 text-xs text-slate-700"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-3 text-xs">
        <h2 className="text-sm font-semibold text-slate-900">Notification Preferences</h2>
        <div className="flex flex-wrap gap-6">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.store.notifications.notifyLowStock}
              onChange={(e) =>
                updateNotifications({ ...state.store.notifications, notifyLowStock: e.target.checked })
              }
            />
            Low-stock SKU alerts
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.store.notifications.notifyDelayedShipments}
              onChange={(e) =>
                updateNotifications({ ...state.store.notifications, notifyDelayedShipments: e.target.checked })
              }
            />
            Delayed shipment alerts
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.store.notifications.notifyPendingApprovals}
              onChange={(e) =>
                updateNotifications({ ...state.store.notifications, notifyPendingApprovals: e.target.checked })
              }
            />
            Pending approval reminders
          </label>
        </div>
      </section>

      {/* Reset Demo Data Confirmation Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Reset all demo store data?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This clears all locally persisted edits, draft products, stock adjustments, segments, approvals, and activity logs, restoring the initial multi-category demo seed data.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="rounded border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDemoData();
                  setConfirmResetOpen(false);
                  setNotice('Demo store data has been reset to initial sample records.');
                }}
                className="rounded bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
