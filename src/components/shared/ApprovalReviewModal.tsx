import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Edit3, ShieldCheck, X } from 'lucide-react';
import { useStoreState } from '../../store/useStoreState';
import { ClassificationTag } from './StatusBadge';

interface ApprovalReviewModalProps {
  open: boolean;
  onClose: () => void;
  initialApprovalId?: string | null;
}

export function ApprovalReviewModal({ open, onClose, initialApprovalId }: ApprovalReviewModalProps) {
  const { state, resolveApproval } = useStoreState();
  const pendingApprovals = state.approvals.filter((a) => a.decision === 'pending');

  const [selectedId, setSelectedId] = useState<string | null>(initialApprovalId ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [editedJson, setEditedJson] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const active =
    pendingApprovals.find((a) => a.id === selectedId) ??
    pendingApprovals[0] ??
    null;

  useEffect(() => {
    if (initialApprovalId) {
      setSelectedId(initialApprovalId);
    }
  }, [initialApprovalId]);

  useEffect(() => {
    if (active) {
      setEditedMessage(active.externalMessageText ?? '');
      setEditedJson(JSON.stringify(active.newValues, null, 2));
      setIsEditing(false);
    }
  }, [active?.id]);

  if (!open) return null;

  const handleDecision = async (decision: 'approved' | 'edited_approved' | 'cancelled') => {
    if (!active) return;
    setFeedback(null);

    if (decision === 'edited_approved') {
      let parsedValues = active.newValues;
      try {
        parsedValues = JSON.parse(editedJson);
      } catch {
        setFeedback({ ok: false, message: 'Edited JSON values are invalid. Fix syntax before approving.' });
        return;
      }
      const res = await resolveApproval(active.id, 'edited_approved', {
        newValues: parsedValues,
        externalMessageText: active.externalMessageText !== undefined ? editedMessage : undefined,
      });
      setFeedback(res);
      return;
    }

    const res = await resolveApproval(active.id, decision);
    setFeedback(res);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h2 id="approval-modal-title" className="text-base font-semibold text-slate-900">
              Action Review &amp; Approval Queue
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              · {pendingApprovals.length} pending
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
            aria-label="Close approval modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {feedback && (
            <div
              className={`rounded border px-4 py-3 text-sm ${
                feedback.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {pendingApprovals.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No actions awaiting approval</p>
              <p className="mt-1 text-sm text-slate-500">
                All pending actions have been reviewed. Every decision is recorded in the Activity Log.
              </p>
            </div>
          ) : (
            <>
              {pendingApprovals.length > 1 && (
                <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
                  {pendingApprovals.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`rounded border px-3 py-1.5 text-xs font-medium text-left transition-colors ${
                        active?.id === item.id
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {idx + 1}. {item.title}
                    </button>
                  ))}
                </div>
              )}

              {active && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">
                        Source: {active.source.replace('_', ' ')} · Requested{' '}
                        <span className="font-mono tabular-nums">{active.createdAt.slice(0, 16).replace('T', ' ')}</span>
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">{active.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{active.actionDescription}</p>
                    </div>
                    <ClassificationTag classification={active.classification} />
                  </div>

                  <div className="rounded border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Affected records: </span>
                    {active.affectedRecords.length > 0 ? active.affectedRecords.join(' · ') : 'None specified'}
                  </div>

                  {(active.riskNote || (active.missingInformation && active.missingInformation.length > 0)) && (
                    <div className="rounded border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1.5">
                      {active.riskNote && (
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                          <span>{active.riskNote}</span>
                        </div>
                      )}
                      {active.missingInformation && active.missingInformation.length > 0 && (
                        <div>
                          <span className="font-semibold">Missing or unverified information: </span>
                          {active.missingInformation.join('; ')}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded border border-slate-200 p-3.5">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Current / Before</p>
                      <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap break-words">
                        {JSON.stringify(active.oldValues, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded border border-slate-200 p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-900">Proposed / After (Demo)</p>
                        <button
                          type="button"
                          onClick={() => setIsEditing((v) => !v)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                        >
                          <Edit3 className="h-3 w-3" />
                          {isEditing ? 'Done editing' : 'Edit values'}
                        </button>
                      </div>
                      {isEditing ? (
                        <textarea
                          value={editedJson}
                          onChange={(e) => setEditedJson(e.target.value)}
                          rows={5}
                          className="w-full rounded border border-slate-300 p-2 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      ) : (
                        <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-words">
                          {JSON.stringify(active.newValues, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>

                  {active.externalMessageText !== undefined && (
                    <div className="rounded border border-slate-200 p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-slate-900">
                          External Message Preview (Simulated in Demo)
                        </p>
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="text-xs font-medium text-blue-700 hover:underline"
                          >
                            Edit message
                          </button>
                        )}
                      </div>
                      {isEditing ? (
                        <textarea
                          value={editedMessage}
                          onChange={(e) => setEditedMessage(e.target.value)}
                          rows={5}
                          className="w-full rounded border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                          {active.externalMessageText}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <p className="text-xs text-slate-500">
            Previewing never executes an action. Every decision is logged.
          </p>
          <div className="flex items-center gap-2.5">
            {active ? (
              <>
                <button
                  type="button"
                  onClick={() => handleDecision('cancelled')}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  Cancel Action
                </button>
                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => handleDecision('edited_approved')}
                    className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Save Edits &amp; Approve (Demo)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDecision('approved')}
                    className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve &amp; Run in Demo
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
