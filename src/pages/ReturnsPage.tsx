import { useState } from 'react';
import { Ban, Check, ShieldAlert, Sparkles, X } from 'lucide-react';
import { useStoreState } from '../store/useStoreState';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { StatusTag } from '../components/shared/StatusBadge';

interface ReturnsPageProps {
  onOpenApprovals: () => void;
}

export function ReturnsPage({ onOpenApprovals }: ReturnsPageProps) {
  const { state, saveReturnAnalysis, requestReturnDecision, attemptBlockedRefund } = useStoreState();

  const [selectedId, setSelectedId] = useState<string>(state.returns[0]?.id ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [blockedAlert, setBlockedAlert] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState('');

  const active = state.returns.find((r) => r.id === selectedId) ?? state.returns[0] ?? null;
  const matchedPolicy = active ? state.store.policies.find((p) => p.id === active.matchedPolicyId) : null;

  const handleGenerateAiSummary = () => {
    if (!active) return;
    const summary = `Return ${active.returnNumber} for ${active.orderNumber} (${active.customerName}): ${active.customerReason} Evidence attached: ${
      active.evidenceAttached ? 'Yes' : 'No — missing photo evidence'
    }. Requested amount: ${formatCurrency(active.requestedAmount, state.store.currency)}. Matched policy: ${
      matchedPolicy?.title ?? '30-Day Return Policy'
    }.`;
    const draft = `Hi ${active.customerName},\n\nWe reviewed return request ${active.returnNumber} for order ${active.orderNumber}. ${
      active.evidenceAttached
        ? 'Thank you for including photo evidence. Our team is completing the final review under our 30-Day Return Policy.'
        : 'Before we can make a decision under our Damaged Item Policy, please reply with a clear photo of the item and outer packaging.'
    }\n\nBest regards,\n${state.store.name} Support (Demo)`;
    saveReturnAnalysis(active.id, summary, draft);
    setResponseDraft(draft);
    setNotice('Generated policy-grounded case summary and draft response.');
  };

  const handleDecision = async (decision: 'approved' | 'declined') => {
    if (!active) return;
    setBlockedAlert(null);
    const res = await requestReturnDecision(active.id, decision, responseDraft || active.aiDraftResponse);
    setNotice(res.message);
    if (res.needsApproval) {
      onOpenApprovals();
    }
  };

  const handleAttemptRefund = () => {
    if (!active) return;
    const res = attemptBlockedRefund(active.id);
    setBlockedAlert(res.message);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Returns &amp; Refunds</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review return requests against store policies. Decisions require approval; real payment refunds remain blocked in demo mode.
        </p>
      </div>

      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {blockedAlert && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
          <span>{blockedAlert}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Return Requests List */}
        <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white divide-y divide-slate-200">
          {state.returns.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setSelectedId(r.id);
                setResponseDraft(r.aiDraftResponse ?? '');
                setBlockedAlert(null);
              }}
              className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                active?.id === r.id ? 'bg-blue-50/70' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-900">
                  {r.returnNumber} · {r.orderNumber}
                </span>
                <StatusTag
                  tone={
                    r.status === 'approved_simulated'
                      ? 'success'
                      : r.status === 'declined_simulated'
                      ? 'neutral'
                      : r.status === 'awaiting_evidence'
                      ? 'danger'
                      : 'warning'
                  }
                  label={r.status.replace(/_/g, ' ')}
                />
              </div>
              <p className="mt-1 text-sm font-medium text-slate-800">{r.customerName}</p>
              <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{r.customerReason}</p>
              <p className="mt-1.5 text-xs font-mono tabular-nums text-slate-500">
                Requested: {formatCurrency(r.requestedAmount, state.store.currency)} · Evidence:{' '}
                {r.evidenceAttached ? 'Attached' : 'Missing'}
              </p>
            </button>
          ))}
        </div>

        {/* Active Return Review Detail */}
        <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-white p-5 space-y-5">
          {active ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {active.returnNumber} ({active.customerName})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Order <span className="font-mono">{active.orderNumber}</span> · Submitted{' '}
                    {formatDateTime(active.createdAt, state.store.dateFormat, state.store.timezone)}
                  </p>
                </div>
                <StatusTag tone="info" label="SIMULATED DEMO WORKFLOW" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded border border-slate-200 p-3.5 space-y-1">
                  <p className="font-semibold text-slate-900">Customer Reason &amp; Evidence</p>
                  <p className="text-slate-700">{active.customerReason}</p>
                  <p className={active.evidenceAttached ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                    {active.evidenceSummary}
                  </p>
                </div>
                <div className="rounded border border-slate-200 p-3.5 space-y-1">
                  <p className="font-semibold text-slate-900">Applicable Store Policy</p>
                  <p className="font-medium text-slate-800">{matchedPolicy?.title}</p>
                  <p className="text-slate-600">{matchedPolicy?.summary}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Affected Items</p>
                <div className="rounded border border-slate-200 divide-y divide-slate-200">
                  {active.affectedItems.map((item, i) => (
                    <div key={i} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-medium text-slate-900">{item.title}</p>
                        <p className="text-slate-500">
                          {item.variantLabel} · <span className="font-mono">{item.sku}</span> · Qty {item.quantity}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {formatCurrency(item.unitPrice * item.quantity, state.store.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Case Summary & Draft Response */}
              <div className="rounded border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-900">Case Summary &amp; Customer Response Draft</p>
                  <button
                    type="button"
                    onClick={handleGenerateAiSummary}
                    className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                  >
                    <Sparkles className="h-3 w-3" />
                    Summarize &amp; Draft Response
                  </button>
                </div>
                {active.aiSummary && <p className="text-xs text-slate-700 leading-relaxed">{active.aiSummary}</p>}
                <textarea
                  rows={4}
                  value={responseDraft || active.aiDraftResponse || ''}
                  onChange={(e) => setResponseDraft(e.target.value)}
                  placeholder="Optional response draft to include with return decision..."
                  className="w-full rounded border border-slate-300 bg-white p-2.5 text-xs text-slate-900"
                />
              </div>

              {/* Approval-gated Return Decision + Hard-Blocked Refund Control */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={handleAttemptRefund}
                  className="inline-flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-800 hover:bg-red-100"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Issue Payment Refund (Blocked)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecision('declined')}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Prepare Decline (Approval)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision('approved')}
                    className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Prepare Approval (Demo)
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-slate-700">Return Timeline</p>
                {active.timeline.map((t) => (
                  <div key={t.id} className="rounded border border-slate-200 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-medium text-slate-800">{t.actor}</span>
                      <span className="font-mono tabular-nums">
                        {formatDateTime(t.timestamp, state.store.dateFormat, state.store.timezone)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-slate-700">{t.note}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">No return requests found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
