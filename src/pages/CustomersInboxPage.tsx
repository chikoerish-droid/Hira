import { useEffect, useState } from 'react';
import { Download, Plus, Search, Send, Sparkles, Trash2, Users } from 'lucide-react';
import { computeCustomerProfiles, evaluateSegmentMembers } from '../domain/segmentationEngine';
import { useStoreState } from '../store/useStoreState';
import type { Conversation, CustomerSegmentRule, ProductCategory } from '../types/domain';
import { downloadTextFile, escapeCsvCell, formatCurrency, formatDateTime } from '../utils/formatters';
import { StatusTag } from '../components/shared/StatusBadge';

interface CustomersInboxPageProps {
  initialFilterHint?: string;
  onOpenApprovals: () => void;
}

const ALL_CATEGORIES: Array<ProductCategory | 'All'> = [
  'All',
  'Electronics',
  'Home & Kitchen',
  'Beauty & Personal Care',
  'Books & Stationery',
  'Specialty Groceries',
  'Digital Downloads',
  'Subscriptions & Bundles',
  'Made-to-Order Goods',
];

export function CustomersInboxPage({ initialFilterHint, onOpenApprovals }: CustomersInboxPageProps) {
  const {
    state,
    saveConversationDraft,
    requestSendConversationReply,
    updateConversationStatus,
    saveCustomerSegment,
    deleteCustomerSegment,
    logActivity,
  } = useStoreState();

  const [activeTab, setActiveTab] = useState<'inbox' | 'segments'>('inbox');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'waiting' | 'resolved'>(
    initialFilterHint === 'open' ? 'open' : 'all'
  );
  const [search, setSearch] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string>(state.conversations[0]?.id ?? '');
  const [draftText, setDraftText] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Segmentation State
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(state.customerSegments[0]?.id ?? '');
  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const [segName, setSegName] = useState('');
  const [segDesc, setSegDesc] = useState('');
  const [segMinSpent, setSegMinSpent] = useState('100');
  const [segMinOrders, setSegMinOrders] = useState('1');
  const [segRecencyMode, setSegRecencyMode] = useState<CustomerSegmentRule['recencyMode']>('any');
  const [segRecencyDays, setSegRecencyDays] = useState('30');
  const [segCategory, setSegCategory] = useState<ProductCategory | 'All'>('All');

  const filteredConversations = state.conversations.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !c.customerName.toLowerCase().includes(q) &&
        !c.subject.toLowerCase().includes(q) &&
        !(c.orderNumber ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const activeConv = state.conversations.find((c) => c.id === selectedConvId) ?? filteredConversations[0] ?? null;

  useEffect(() => {
    if (activeConv) {
      setDraftText(activeConv.draftReply ?? '');
    }
  }, [activeConv?.id, activeConv?.draftReply]);

  const linkedOrder = activeConv?.orderId ? state.orders.find((o) => o.id === activeConv.orderId) ?? null : null;
  const linkedShipment = activeConv?.orderId ? state.shipments.find((s) => s.orderId === activeConv.orderId) ?? null : null;
  const customerOrders = activeConv ? state.orders.filter((o) => o.customerId === activeConv.customerId) : [];

  const handleDraftWithAi = async (conv: Conversation) => {
    setDraftLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: conv,
          order: linkedOrder,
          shipment: linkedShipment,
          policies: state.store.policies,
          storeName: state.store.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Honest error notice + deterministic policy-grounded template draft
        const shipPol = state.store.policies.find((p) => p.category === 'shipping');
        const fallbackDraft = `Hi ${conv.customerName},\n\nThank you for contacting ${state.store.name} regarding ${conv.orderNumber ?? conv.subject}. Based on our current demo records, your order payment status is "${linkedOrder?.paymentStatus ?? 'on file'}" and fulfillment status is "${linkedOrder?.fulfillmentStatus ?? 'under review'}"${linkedShipment?.trackingNumber ? ` (tracking: ${linkedShipment.trackingNumber})` : ''}.\n\nPer our ${shipPol?.title ?? 'Shipping Policy'}: ${shipPol?.summary ?? ''}\n\nPlease note we cannot confirm an exact carrier delivery date until tracking updates. Let us know if you need any updates.\n\nBest regards,\n${state.store.name} Support (Demo)`;
        setErrorMsg(`${json.error} Prepared a deterministic policy-grounded template draft for you to edit.`);
        setDraftText(fallbackDraft);
        saveConversationDraft(conv.id, fallbackDraft);
        return;
      }

      const nextDraft = json.draftReply || '';
      setDraftText(nextDraft);
      saveConversationDraft(conv.id, nextDraft, json.aiSummary, json.classification);
      setNotice('AI drafted a policy-grounded reply. Review and edit before submitting for approval.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to draft reply.');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSendForApproval = async () => {
    if (!activeConv || !draftText.trim()) return;
    saveConversationDraft(activeConv.id, draftText);
    const isFaq = activeConv.classification === 'policy_faq';
    const res = await requestSendConversationReply(activeConv.id, draftText, isFaq);
    setNotice(res.message);
    if (res.needsApproval) {
      onOpenApprovals();
    }
  };

  // Segmentation computations
  const profiles = computeCustomerProfiles(state.customers, state.orders, state.products);
  const activeSegment = state.customerSegments.find((s) => s.id === selectedSegmentId) ?? state.customerSegments[0] ?? null;
  const segmentMembers = activeSegment ? evaluateSegmentMembers(activeSegment, profiles) : [];

  const handleCreateSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!segName.trim()) return;
    const rule: CustomerSegmentRule = {
      id: `seg-${Date.now()}`,
      name: segName.trim(),
      description:
        segDesc.trim() ||
        `Spend >= $${Number(segMinSpent || 0)}, Orders >= ${Number(segMinOrders || 1)}`,
      minTotalSpent: Math.max(0, Number(segMinSpent || 0)),
      minOrderCount: Math.max(0, Number(segMinOrders || 0)),
      recencyMode: segRecencyMode,
      recencyDays: Math.max(1, Number(segRecencyDays || 30)),
      categoryFilter: segCategory,
      createdAt: new Date().toISOString(),
    };
    saveCustomerSegment(rule);
    setSelectedSegmentId(rule.id);
    setShowSegmentForm(false);
    setSegName('');
    setSegDesc('');
    setNotice(`Created customer segment "${rule.name}".`);
  };

  const handleExportSegment = (format: 'csv' | 'json') => {
    if (!activeSegment) return;
    if (format === 'csv') {
      const headers = ['name', 'email_demo', 'ordersCount', 'totalSpent', 'averageOrderValue', 'lastOrderAt', 'purchasedCategories'];
      const rows = segmentMembers.map((m) =>
        [
          m.customer.name,
          m.customer.email,
          m.computedOrderCount,
          m.computedTotalSpent.toFixed(2),
          m.averageOrderValue.toFixed(2),
          m.lastOrderAt ?? '',
          m.purchasedCategories.join(';'),
        ]
          .map(escapeCsvCell)
          .join(',')
      );
      downloadTextFile(
        `segment-${activeSegment.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
        [headers.join(','), ...rows].join('\n')
      );
    } else {
      downloadTextFile(
        `segment-${activeSegment.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`,
        JSON.stringify({ segment: activeSegment, members: segmentMembers }, null, 2),
        'application/json'
      );
    }
    logActivity({
      actor: 'Merchant User',
      actionSummary: `Exported ${segmentMembers.length} customer(s) from segment "${activeSegment.name}" (${format.toUpperCase()})`,
      targetRecords: [activeSegment.name],
      classification: 'read_only',
      result: 'completed',
      approvalDecision: 'auto_permitted',
      isSimulated: true,
    });
    setNotice(`Exported ${segmentMembers.length} member(s) from "${activeSegment.name}" as ${format.toUpperCase()}.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Customers &amp; Inbox</h1>
          <p className="mt-1 text-sm text-slate-600">
            Policy-grounded customer support drafts (simulated send only) and purchase-history customer segmentation.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`rounded px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'inbox' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Support Inbox ({state.conversations.filter((c) => c.status !== 'resolved').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('segments')}
            className={`rounded px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'segments' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Customer Segments ({state.customerSegments.length})
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{errorMsg}</div>
      )}

      {activeTab === 'inbox' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Conversation List */}
          <div className="lg:col-span-4 rounded-lg border border-slate-200 bg-white flex flex-col">
            <div className="p-3 border-b border-slate-200 space-y-2.5">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customer or order #..."
                  className="w-full rounded border border-slate-300 pl-8 pr-3 py-1.5 text-xs"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'open', 'waiting', 'resolved'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`flex-1 rounded py-1 text-xs font-medium capitalize ${
                      statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredConversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedConvId(c.id)}
                  className={`w-full text-left p-3.5 hover:bg-slate-50 transition-colors ${
                    activeConv?.id === c.id ? 'bg-blue-50/70' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">{c.customerName}</span>
                    <StatusTag
                      tone={c.status === 'open' ? 'warning' : c.status === 'waiting' ? 'info' : 'success'}
                      label={c.status}
                    />
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-700 truncate">{c.subject}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {c.channel} {c.orderNumber ? `· ${c.orderNumber}` : ''}
                  </p>
                </button>
              ))}
              {filteredConversations.length === 0 && (
                <p className="p-6 text-center text-xs text-slate-500">No conversations match filters.</p>
              )}
            </div>
          </div>

          {/* Thread & Grounded Draft Editor */}
          <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white flex flex-col">
            {activeConv ? (
              <>
                <div className="border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{activeConv.subject}</h2>
                    <p className="text-xs text-slate-500">
                      {activeConv.customerName} · {activeConv.classification.replace('_', ' ')}
                    </p>
                  </div>
                  <select
                    value={activeConv.status}
                    onChange={(e) => updateConversationStatus(activeConv.id, e.target.value as Conversation['status'])}
                    className="rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                  >
                    <option value="open">Open</option>
                    <option value="waiting">Waiting</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                {activeConv.aiSummary && (
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">AI Case Summary: </span>
                    {activeConv.aiSummary}
                  </div>
                )}

                <div className="flex-1 p-5 space-y-3 max-h-[340px] overflow-y-auto">
                  {activeConv.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded border p-3 text-xs space-y-1 ${
                        m.sender === 'customer'
                          ? 'border-slate-200 bg-slate-50'
                          : 'border-blue-200 bg-blue-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-semibold text-slate-900">{m.senderName}</span>
                        <span className="font-mono tabular-nums">
                          {formatDateTime(m.timestamp, state.store.dateFormat, state.store.timezone)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    </div>
                  ))}
                </div>

                {/* Draft Composer */}
                <div className="border-t border-slate-200 p-4 space-y-3 bg-slate-50/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Editable Reply Draft (Simulated — Requires Approval)
                    </span>
                    <button
                      type="button"
                      disabled={draftLoading}
                      onClick={() => handleDraftWithAi(activeConv)}
                      className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3" />
                      {draftLoading ? 'Drafting...' : 'AI Draft from Order & Policy'}
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={draftText}
                    onChange={(e) => {
                      setDraftText(e.target.value);
                      saveConversationDraft(activeConv.id, e.target.value);
                    }}
                    placeholder="Draft a customer reply grounded in verified order status and store policy..."
                    className="w-full rounded border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftText('');
                        saveConversationDraft(activeConv.id, '');
                      }}
                      className="text-xs text-slate-500 hover:text-red-700"
                    >
                      Discard Draft
                    </button>
                    <button
                      type="button"
                      disabled={!draftText.trim()}
                      onClick={handleSendForApproval}
                      className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Review &amp; Send Reply (Simulated)
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">Select a conversation to inspect.</p>
            )}
          </div>

          {/* Order History & Approved Policies Side Pane */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-900">Customer Order History</h3>
              {customerOrders.length > 0 ? (
                <div className="space-y-2">
                  {customerOrders.map((ord) => (
                    <div key={ord.id} className="rounded border border-slate-200 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-slate-900">{ord.orderNumber}</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          {formatCurrency(ord.totalAmount, ord.currency)}
                        </span>
                      </div>
                      <p className="text-slate-600">
                        {ord.paymentStatus} · {ord.fulfillmentStatus}
                      </p>
                      {ord.exceptionFlag && <p className="text-amber-800">{ord.exceptionFlag}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No linked orders found.</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-900">Approved Store Policies</h3>
              {state.store.policies.map((pol) => (
                <div key={pol.id} className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0 text-xs">
                  <p className="font-medium text-slate-800">{pol.title}</p>
                  <p className="text-slate-600 mt-0.5">{pol.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Customer Segmentation Tool */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Group customers dynamically using verified demo purchase history, total spending, order frequency, and recency.
            </p>
            <button
              type="button"
              onClick={() => setShowSegmentForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Define Segment
            </button>
          </div>

          {showSegmentForm && (
            <form onSubmit={handleCreateSegment} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Create Custom Customer Segment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Segment Name</label>
                  <input
                    required
                    value={segName}
                    onChange={(e) => setSegName(e.target.value)}
                    placeholder="e.g., High-Value Coffee Buyers"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                  <input
                    value={segDesc}
                    onChange={(e) => setSegDesc(e.target.value)}
                    placeholder="Optional campaign criteria note"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Minimum Total Spent ({state.store.currency})</label>
                  <input
                    type="number"
                    min="0"
                    value={segMinSpent}
                    onChange={(e) => setSegMinSpent(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Minimum Order Frequency (Orders)</label>
                  <input
                    type="number"
                    min="0"
                    value={segMinOrders}
                    onChange={(e) => setSegMinOrders(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Order Recency Filter</label>
                  <div className="flex gap-2">
                    <select
                      value={segRecencyMode}
                      onChange={(e) => setSegRecencyMode(e.target.value as CustomerSegmentRule['recencyMode'])}
                      className="flex-1 rounded border border-slate-300 px-2.5 py-2 text-sm bg-white"
                    >
                      <option value="any">Any order date</option>
                      <option value="within_days">Last order within X days</option>
                      <option value="older_than_days">Last order older than X days</option>
                    </select>
                    {segRecencyMode !== 'any' && (
                      <input
                        type="number"
                        min="1"
                        value={segRecencyDays}
                        onChange={(e) => setSegRecencyDays(e.target.value)}
                        className="w-24 rounded border border-slate-300 px-2.5 py-2 text-sm font-mono"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Purchased Category</label>
                  <select
                    value={segCategory}
                    onChange={(e) => setSegCategory(e.target.value as ProductCategory | 'All')}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowSegmentForm(false)} className="rounded border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700">
                  Cancel
                </button>
                <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700">
                  Save Segment
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Segment Definitions Sidebar */}
            <div className="lg:col-span-4 space-y-2.5">
              {state.customerSegments.map((seg) => {
                const count = evaluateSegmentMembers(seg, profiles).length;
                const isSelected = activeSegment?.id === seg.id;
                return (
                  <div
                    key={seg.id}
                    className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                      isSelected ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    onClick={() => setSelectedSegmentId(seg.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{seg.name}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{seg.description}</p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {count}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Spend ≥ {formatCurrency(seg.minTotalSpent, state.store.currency)} · Orders ≥ {seg.minOrderCount}
                      </span>
                      {!seg.id.startsWith('seg-high-value') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomerSegment(seg.id);
                          }}
                          className="text-slate-400 hover:text-red-600"
                          aria-label={`Delete ${seg.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Segment Members & Export */}
            <div className="lg:col-span-8 rounded-lg border border-slate-200 bg-white overflow-hidden">
              {activeSegment ? (
                <>
                  <div className="border-b border-slate-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Users className="h-4 w-4 text-blue-600" />
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {activeSegment.name} ({segmentMembers.length} customers)
                        </h3>
                        <p className="text-xs text-slate-500">{activeSegment.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={segmentMembers.length === 0}
                        onClick={() => handleExportSegment('csv')}
                        className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export Marketing CSV
                      </button>
                      <button
                        type="button"
                        disabled={segmentMembers.length === 0}
                        onClick={() => handleExportSegment('json')}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Export JSON
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                          <th className="py-2.5 px-4">Customer</th>
                          <th className="py-2.5 px-4 text-right">Orders</th>
                          <th className="py-2.5 px-4 text-right">Total Spent</th>
                          <th className="py-2.5 px-4 text-right">AOV</th>
                          <th className="py-2.5 px-4">Last Order</th>
                          <th className="py-2.5 px-4">Categories Purchased</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {segmentMembers.map((m) => (
                          <tr key={m.customer.id}>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">{m.customer.name}</p>
                              <p className="font-mono text-xs text-slate-500">{m.customer.email}</p>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">{m.computedOrderCount}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                              {formatCurrency(m.computedTotalSpent, state.store.currency)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                              {formatCurrency(m.averageOrderValue, state.store.currency)}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                              {m.lastOrderAt ? m.lastOrderAt.slice(0, 10) : '—'}
                              {m.daysSinceLastOrder !== null && ` (${m.daysSinceLastOrder}d ago)`}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600">
                              {m.purchasedCategories.join(' · ') || '—'}
                            </td>
                          </tr>
                        ))}
                        {segmentMembers.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                              No demo customers currently meet all rules for this segment.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="p-8 text-center text-sm text-slate-500">Create or select a segment to view members.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
