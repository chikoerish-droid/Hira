import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Pause, Play, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { useStoreState } from '../store/useStoreState';
import type { Automation, StepClassification } from '../types/domain';
import { formatDateTime } from '../utils/formatters';
import { ClassificationTag, OutcomeTag, StatusTag } from '../components/shared/StatusBadge';

export function AutomationsPage() {
  const { state, saveAutomation, toggleAutomationStatus, runAutomation } = useStoreState();
  const [expandedId, setExpandedId] = useState<string | null>(state.automations[0]?.id ?? null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAuto, setEditingAuto] = useState<Automation | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Form fields for Create/Edit
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState('New paid order');
  const [scheduleOrSource, setScheduleOrSource] = useState('Event: order.paid (Demo)');
  const [conditionsText, setConditionsText] = useState('paymentStatus === paid');
  const [step1Title, setStep1Title] = useState('Inspect affected demo records');
  const [step2Title, setStep2Title] = useState('Prepare draft or exception note');
  const [step2Class, setStep2Class] = useState<StepClassification>('draft');
  const [approvalPolicy, setApprovalPolicy] = useState<Automation['approvalPolicy']>('always_review_mutations');
  const [retryOnSafeFailure, setRetryOnSafeFailure] = useState(true);

  const openCreate = () => {
    setEditingAuto(null);
    setName('');
    setDescription('');
    setTrigger('Low-stock threshold reached');
    setScheduleOrSource('Schedule: Every 6 hours (Demo)');
    setConditionsText('available <= lowStockThreshold');
    setStep1Title('Scan catalog stock levels');
    setStep2Title('Prepare replenishment suggestion list');
    setStep2Class('draft');
    setApprovalPolicy('always_review_mutations');
    setRetryOnSafeFailure(true);
    setShowBuilder(true);
  };

  const openEdit = (auto: Automation) => {
    setEditingAuto(auto);
    setName(auto.name);
    setDescription(auto.description);
    setTrigger(auto.trigger);
    setScheduleOrSource(auto.scheduleOrSource);
    setConditionsText(auto.conditions.join('\n'));
    setStep1Title(auto.steps[0]?.title ?? 'Inspect records');
    setStep2Title(auto.steps[1]?.title ?? 'Prepare action');
    setStep2Class(auto.steps[1]?.classification ?? 'draft');
    setApprovalPolicy(auto.approvalPolicy);
    setRetryOnSafeFailure(auto.retryOnSafeFailure);
    setShowBuilder(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const next: Automation = {
      id: editingAuto?.id ?? `auto-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || `${trigger} -> ${step1Title} -> ${step2Title}`,
      trigger: trigger.trim(),
      scheduleOrSource: scheduleOrSource.trim(),
      conditions: conditionsText.split('\n').map((l) => l.trim()).filter(Boolean),
      steps: [
        { id: 's1', title: step1Title.trim() || 'Inspect store data', classification: 'read_only' },
        { id: 's2', title: step2Title.trim() || 'Prepare draft', classification: step2Class },
      ],
      approvalPolicy,
      // New automations ALWAYS start paused until reviewed and enabled
      status: editingAuto ? editingAuto.status : 'paused',
      retryOnSafeFailure,
      duplicateGuardWindowMinutes: editingAuto?.duplicateGuardWindowMinutes ?? 60,
      lastRunAt: editingAuto?.lastRunAt,
      runHistory: editingAuto?.runHistory ?? [],
    };
    saveAutomation(next);
    setShowBuilder(false);
    setExpandedId(next.id);
    setBannerMessage(
      editingAuto
        ? `Updated automation "${next.name}".`
        : `Created "${next.name}" in PAUSED state. Review and dry-run before enabling.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Automation Center</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure event and scheduled workflows. New automations start paused; all runs execute in Demo Store simulation mode.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          New Automation
        </button>
      </div>

      {bannerMessage && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900">
          {bannerMessage}
        </div>
      )}

      {showBuilder && (
        <form onSubmit={handleSave} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {editingAuto ? `Edit Automation: ${editingAuto.name}` : 'Create Automation (Starts Paused)'}
            </h2>
            <button
              type="button"
              onClick={() => setShowBuilder(false)}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Workflow Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Delayed Order Morning Check"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Trigger</label>
              <input
                required
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Schedule / Event Source</label>
              <input
                value={scheduleOrSource}
                onChange={(e) => setScheduleOrSource(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Approval Policy</label>
              <select
                value={approvalPolicy}
                onChange={(e) => setApprovalPolicy(e.target.value as Automation['approvalPolicy'])}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="always_review_mutations">Always review mutating/external steps</option>
                <option value="narrow_rule_auto">Allow narrow auto-approval rules where enabled</option>
                <option value="manual_only">Manual dry-run only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Step 1 (Read-only)</label>
              <input
                value={step1Title}
                onChange={(e) => setStep1Title(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Step 2 Action</label>
                <input
                  value={step2Title}
                  onChange={(e) => setStep2Title(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Step 2 Type</label>
                <select
                  value={step2Class}
                  onChange={(e) => setStep2Class(e.target.value as StepClassification)}
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm bg-white"
                >
                  <option value="draft">Draft</option>
                  <option value="reversible_change">Reversible</option>
                  <option value="consequential_external">External</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Conditions (one per line)</label>
            <textarea
              rows={2}
              value={conditionsText}
              onChange={(e) => setConditionsText(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={retryOnSafeFailure}
                onChange={(e) => setRetryOnSafeFailure(e.target.checked)}
              />
              Enable automatic retries on safe read-only / transient failures (with duplicate guard)
            </label>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              {editingAuto ? 'Save Changes' : 'Create Automation (Paused)'}
            </button>
          </div>
        </form>
      )}

      {/* Automations List */}
      <div className="space-y-3">
        {state.automations.map((auto) => {
          const isExpanded = expandedId === auto.id;
          return (
            <div key={auto.id} className="rounded-lg border border-slate-200 bg-white">
              <div className="p-5 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : auto.id)}
                      className="inline-flex items-center gap-1.5 text-left font-semibold text-slate-900 hover:text-blue-700"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span>{auto.name}</span>
                    </button>
                    <StatusTag
                      tone={auto.status === 'active' ? 'success' : auto.status === 'error' ? 'danger' : 'neutral'}
                      label={auto.status === 'active' ? 'Active (Demo)' : auto.status === 'error' ? 'Error State' : 'Paused'}
                      showIcon
                    />
                  </div>
                  <p className="text-sm text-slate-600">{auto.description}</p>
                  <p className="text-xs text-slate-500">
                    Trigger: {auto.trigger} · Source: {auto.scheduleOrSource} · Duplicate guard:{' '}
                    <span className="font-mono tabular-nums">{auto.duplicateGuardWindowMinutes}m</span>
                  </p>
                  {auto.lastError && (
                    <p className="text-xs text-red-700 flex items-center gap-1.5 pt-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{auto.lastError}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const run = runAutomation(auto.id, 'dry_run', false);
                      setExpandedId(auto.id);
                      setBannerMessage(run.resultSummary);
                    }}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Dry Run
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const run = runAutomation(auto.id, 'simulated_run', false);
                      setExpandedId(auto.id);
                      setBannerMessage(run.resultSummary);
                    }}
                    className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100 whitespace-nowrap"
                  >
                    Run Simulated
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAutomationStatus(auto.id)}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    {auto.status === 'active' ? (
                      <>
                        <Pause className="h-3 w-3" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" /> Resume
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(auto)}
                    className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/70 p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">Configured Steps &amp; Safety Classification</p>
                      <ul className="space-y-2">
                        {auto.steps.map((s, i) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs">
                            <span className="text-slate-800">
                              <span className="font-mono text-slate-400 mr-2">0{i + 1}.</span>
                              {s.title}
                            </span>
                            <ClassificationTag classification={s.classification} />
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-700">Conditions &amp; Failure Handling</p>
                        <button
                          type="button"
                          onClick={() => {
                            const run = runAutomation(auto.id, 'dry_run', true);
                            setBannerMessage(run.resultSummary);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline"
                        >
                          <ShieldAlert className="h-3 w-3" />
                          Test Error &amp; Retry Guard
                        </button>
                      </div>
                      <div className="rounded border border-slate-200 bg-white p-3 text-xs space-y-1.5 text-slate-600">
                        <p>
                          <span className="font-medium text-slate-800">Conditions:</span> {auto.conditions.join(' AND ')}
                        </p>
                        <p>
                          <span className="font-medium text-slate-800">Safe failure retries:</span>{' '}
                          {auto.retryOnSafeFailure ? 'Enabled (up to 2 retries on read-only steps)' : 'Disabled'}
                        </p>
                        <p>
                          <span className="font-medium text-slate-800">Approval policy:</span> {auto.approvalPolicy.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      Run History ({auto.runHistory.length}) — All Runs Marked SIMULATED
                    </p>
                    {auto.runHistory.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No runs recorded yet. Click Dry Run or Run Simulated above.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {auto.runHistory.map((run) => (
                          <div key={run.id} className="rounded border border-slate-200 bg-white p-3.5 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <StatusTag tone={run.status === 'failed' ? 'danger' : 'info'} label="SIMULATED" />
                                <span className="text-xs font-medium text-slate-900">{run.inputsSummary}</span>
                              </div>
                              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                                {formatDateTime(run.startedAt, state.store.dateFormat, state.store.timezone)}
                                {run.retryCount > 0 && ` · ${run.retryCount} retries`}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700">{run.resultSummary}</p>
                            <div className="space-y-1 pt-1">
                              {run.stepsExecuted.map((st, idx) => (
                                <div key={idx} className="flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-100 pt-1">
                                  <span className="text-slate-700">{st.stepTitle}: {st.detail}</span>
                                  <OutcomeTag status={st.outcome} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
