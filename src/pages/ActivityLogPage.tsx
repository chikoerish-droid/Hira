import { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useStoreState } from '../store/useStoreState';
import { formatDateTime } from '../utils/formatters';
import { ClassificationTag, OutcomeTag } from '../components/shared/StatusBadge';

export function ActivityLogPage() {
  const { state } = useStoreState();
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = state.activityLog.filter((a) => {
    if (actorFilter !== 'all' && a.actor !== actorFilter) return false;
    if (resultFilter !== 'all' && a.result !== resultFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSummary = a.actionSummary.toLowerCase().includes(q);
      const matchTarget = a.targetRecords.some((t) => t.toLowerCase().includes(q));
      if (!matchSummary && !matchTarget) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Activity &amp; Audit Log</h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete record of simulated actions, approvals, blocked attempts, and automation runs. No credentials or secrets are ever logged.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action summary or record ID..."
            className="w-full rounded border border-slate-300 pl-9 pr-3 py-1.5 text-sm"
          />
        </div>
        <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} className="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">
          <option value="all">All actors</option>
          <option value="AIRA Operator">AIRA Operator</option>
          <option value="AIRA Automation">AIRA Automation</option>
          <option value="Merchant User">Merchant User</option>
          <option value="System Guard">System Guard</option>
        </select>
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)} className="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">
          <option value="all">All results</option>
          <option value="completed">Completed</option>
          <option value="simulated">Simulated in demo</option>
          <option value="needs_approval">Needs approval</option>
          <option value="blocked">Blocked</option>
          <option value="cancelled">Cancelled</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Audit Ledger */}
      <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-200">
        {filtered.map((ev) => {
          const hasDiff = ev.beforeValue !== undefined || ev.afterValue !== undefined;
          const isExpanded = expandedId === ev.id;
          return (
            <div key={ev.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {hasDiff && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                        className="text-slate-500 hover:text-slate-900"
                        aria-label="Toggle before/after values"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    )}
                    <span className="text-sm font-medium text-slate-900">{ev.actionSummary}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Actor: <span className="font-medium text-slate-700">{ev.actor}</span> · Approval:{' '}
                    <span className="font-mono">{ev.approvalDecision.replace(/_/g, ' ')}</span>
                    {ev.targetRecords.length > 0 && ` · Records: ${ev.targetRecords.join(', ')}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <ClassificationTag classification={ev.classification} />
                  <OutcomeTag status={ev.result} />
                  <span className="font-mono text-xs tabular-nums text-slate-400">
                    {formatDateTime(ev.timestamp, state.store.dateFormat, state.store.timezone)}
                  </span>
                </div>
              </div>

              {isExpanded && hasDiff && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="rounded border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">Before</p>
                    <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">
                      {ev.beforeValue !== undefined ? JSON.stringify(ev.beforeValue, null, 2) : '—'}
                    </pre>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold text-slate-600 mb-1">After (Demo)</p>
                    <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-words">
                      {ev.afterValue !== undefined ? JSON.stringify(ev.afterValue, null, 2) : '—'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">No activity log entries match your search.</p>
        )}
      </div>
    </div>
  );
}
