import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileSpreadsheet,
  Image as ImageIcon,
  Paperclip,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type { NavSectionId } from '../config/brand';
import { evaluateStepPermission } from '../domain/approvalEngine';
import {
  buildLocalOperatorPlan,
  EXAMPLE_OPERATOR_PROMPTS,
  type OperatorAttachment,
} from '../domain/operatorEngine';
import { useStoreState } from '../store/useStoreState';
import type { ActionPlan, ActionPlanStep, Promotion } from '../types/domain';
import { parseSimpleCsv } from '../utils/formatters';
import { ClassificationTag, OutcomeTag } from '../components/shared/StatusBadge';

interface AiOperatorPageProps {
  onNavigate: (section: NavSectionId) => void;
  onOpenApprovals: (approvalId?: string) => void;
}

export function AiOperatorPage({ onNavigate, onOpenApprovals }: AiOperatorPageProps) {
  const {
    state,
    queueApproval,
    logActivity,
    upsertProduct,
    saveConversationDraft,
    savePromotionDraft,
    importProductsFromCsvRows,
  } = useStoreState();

  const [prompt, setPrompt] = useState('');
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [attachments, setAttachments] = useState<OperatorAttachment[]>([]);
  const [activePlan, setActivePlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [geminiAvailable, setGeminiAvailable] = useState<boolean | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [executionNotice, setExecutionNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setGeminiAvailable(Boolean(d.hasGeminiKey)))
      .catch(() => setGeminiAvailable(false));
  }, []);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files) return;
    const next: OperatorAttachment[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      const mimeType = file.type || (file.name.endsWith('.csv') ? 'text/csv' : 'text/plain');
      if (mimeType.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });
        const base64Data = dataUrl.split(',')[1] ?? '';
        next.push({ name: file.name, mimeType, base64Data, previewUrl: dataUrl });
      } else {
        const textContent = await file.text();
        next.push({ name: file.name, mimeType, textContent });
      }
    }
    setAttachments((prev) => [...prev, ...next]);
  };

  const applyReadOnlyAndDraftSteps = async (plan: ActionPlan): Promise<ActionPlan> => {
    const updatedSteps: ActionPlanStep[] = [];
    for (const step of plan.steps) {
      if (step.status === 'blocked') {
        updatedSteps.push(step);
        logActivity({
          actor: 'AIRA Operator',
          actionSummary: `Blocked step: ${step.title}`,
          targetRecords: step.affectedRecords,
          classification: step.classification,
          result: 'blocked',
          approvalDecision: 'blocked_by_policy',
          isSimulated: true,
        });
        continue;
      }

      const evalRes = evaluateStepPermission(step, state.store.approvalRules);

      if (evalRes.decision === 'blocked') {
        updatedSteps.push({ ...step, status: 'blocked', blockedReason: evalRes.reason });
        continue;
      }

      if (evalRes.decision === 'needs_approval') {
        const approval = queueApproval({
          source: 'operator',
          title: step.title,
          actionDescription: step.description,
          classification: step.classification,
          affectedRecords: step.affectedRecords,
          oldValues: step.oldValues ?? {},
          newValues: step.newValues ?? {},
          externalMessageText: step.externalMessageText,
          riskNote: step.riskNote ?? evalRes.reason,
          missingInformation: step.missingInformation,
          duplicateKey: `op:${plan.id}:${step.id}`,
          onApproveAction: {
            type: step.actionType,
            payload: step.payload ?? {},
          },
        });
        updatedSteps.push({
          ...step,
          requiresApproval: true,
          status: 'needs_approval',
          resultDetail: `Queued for review (${approval.id}).`,
        });
        continue;
      }

      // Permitted immediately (read-only or draft)
      if (step.actionType === 'draft_customer_reply' && step.payload?.conversationId && step.externalMessageText) {
        saveConversationDraft(String(step.payload.conversationId), step.externalMessageText);
      } else if (step.actionType === 'prepare_promotion' && step.payload) {
        const promo: Promotion = {
          id: `promo-${Date.now()}`,
          name: String(step.payload.name ?? 'Operator Draft Promotion'),
          code: String(step.payload.code ?? 'DRAFT10'),
          targetType: 'products',
          targetProductIds: Array.isArray(step.payload.targetProductIds)
            ? step.payload.targetProductIds.map(String)
            : [],
          targetCategories: [],
          excludedProductIds: [],
          discountType: step.payload.discountType === 'fixed_amount' ? 'fixed_amount' : 'percentage',
          discountValue: Number(step.payload.discountValue ?? 10),
          eligibleCustomers: 'all',
          startAt: '2026-11-20T00:00',
          endAt: '2026-11-30T23:59',
          status: 'draft',
          createdAt: new Date().toISOString(),
        };
        savePromotionDraft(promo);
      } else if (step.actionType === 'create_product_draft') {
        const csvAtt = attachments.find((a) => a.textContent);
        const imgAtt = attachments.find((a) => a.previewUrl);
        if (csvAtt?.textContent) {
          const parsed = parseSimpleCsv(csvAtt.textContent);
          if (parsed.rows.length > 0) {
            importProductsFromCsvRows(parsed.rows);
          }
        } else {
          await upsertProduct({
            id: `prod-draft-${Date.now()}`,
            title: imgAtt ? `Draft from ${imgAtt.name.replace(/\.[^.]+$/, '')}` : 'Untitled Draft Product',
            description: 'Created from uploaded media via AI Operator. Verify attributes, SKU, and price before publishing.',
            category: 'Electronics',
            fulfillmentType: 'physical',
            status: 'draft',
            imageUrl: imgAtt?.previewUrl,
            tags: ['needs-review'],
            taxable: true,
            requiresShipping: true,
            unverifiedFields: ['price', 'sku', 'category', 'stock'],
            missingFieldsNote: 'Price, SKU, and stock were not supplied in the uploaded image.',
            variants: [
              {
                id: `var-draft-${Date.now()}`,
                productId: '',
                sku: 'PENDING-SKU',
                title: 'Standard',
                attributes: { Source: imgAtt?.name ?? 'Uploaded file' },
                price: 0,
                unitCost: null,
                stock: 0,
                reserved: 0,
                lowStockThreshold: 5,
              },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      logActivity({
        actor: 'AIRA Operator',
        actionSummary: step.title,
        targetRecords: step.affectedRecords,
        classification: step.classification,
        result: step.classification === 'read_only' ? 'completed' : 'simulated',
        approvalDecision: 'auto_permitted',
        afterValue: step.resultDetail,
        isSimulated: true,
      });

      updatedSteps.push({
        ...step,
        status: step.classification === 'read_only' ? 'completed' : 'simulated',
      });
    }
    return { ...plan, steps: updatedSteps };
  };

  const runOperatorWorkflow = async (mode: 'auto' | 'local_deterministic', overridePrompt?: string, clarif?: string) => {
    const reqText = (overridePrompt ?? prompt).trim();
    if (!reqText) return;
    setLoading(true);
    setApiError(null);
    setExecutionNotice(null);

    try {
      let plan: ActionPlan | null = null;

      if (mode === 'auto' && geminiAvailable) {
        const res = await fetch('/api/ai/operator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestText: reqText,
            clarificationAnswer: clarif,
            attachments: attachments.map((a) => ({
              name: a.name,
              mimeType: a.mimeType,
              textContent: a.textContent,
              base64Data: a.base64Data,
            })),
            storeContext: {
              currentReferenceTime: '2026-11-19T23:02:00-08:00',
              store: {
                name: state.store.name,
                currency: state.store.currency,
                shippingSlaBusinessDays: state.store.shippingSlaBusinessDays,
                returnWindowDays: state.store.returnWindowDays,
              },
              policies: state.store.policies,
              products: state.products.map((p) => ({
                id: p.id,
                title: p.title,
                category: p.category,
                status: p.status,
                variants: p.variants.map((v) => ({
                  sku: v.sku,
                  title: v.title,
                  price: v.price,
                  unitCost: v.unitCost,
                  stock: v.stock,
                  reserved: v.reserved,
                  lowStockThreshold: v.lowStockThreshold,
                })),
              })),
              orders: state.orders.map((o) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                customerName: o.customerName,
                createdAt: o.createdAt,
                paymentStatus: o.paymentStatus,
                fulfillmentStatus: o.fulfillmentStatus,
                exceptionFlag: o.exceptionFlag,
                totalAmount: o.totalAmount,
              })),
              conversations: state.conversations.map((c) => ({
                id: c.id,
                customerName: c.customerName,
                orderNumber: c.orderNumber,
                status: c.status,
                subject: c.subject,
              })),
              returns: state.returns.map((r) => ({
                returnNumber: r.returnNumber,
                orderNumber: r.orderNumber,
                status: r.status,
                requestedAmount: r.requestedAmount,
              })),
            },
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          setApiError(json.error || 'Gemini Operator API returned an error.');
          setLoading(false);
          return;
        }

        const aiPlan = json.plan;
        const planId = `plan-${Date.now()}`;
        const localBase = buildLocalOperatorPlan(reqText, state, attachments, clarif);
        plan = {
          id: planId,
          requestText: reqText,
          understanding: aiPlan.understanding || localBase.understanding,
          retrievedContext: aiPlan.retrievedContext ?? localBase.retrievedContext,
          assumptions: aiPlan.assumptions ?? localBase.assumptions,
          clarificationQuestion: aiPlan.clarificationQuestion || undefined,
          steps:
            Array.isArray(aiPlan.steps) && aiPlan.steps.length > 0
              ? aiPlan.steps.map((s: any, idx: number) => ({
                  id: `${planId}-s${idx + 1}`,
                  title: s.title,
                  description: s.description,
                  classification: (['read_only', 'draft', 'reversible_change', 'consequential_external'].includes(s.classification)
                    ? s.classification
                    : 'read_only') as ActionPlanStep['classification'],
                  requiresApproval: false,
                  status: 'completed' as const,
                  affectedRecords: Array.isArray(s.affectedRecords) ? s.affectedRecords : [],
                  resultDetail: s.resultDetail,
                  externalMessageText: s.externalMessageText || undefined,
                  riskNote: s.riskNote || undefined,
                  missingInformation: Array.isArray(s.missingInformation) ? s.missingInformation : [],
                  actionType: (localBase.steps[idx]?.actionType ?? 'query_orders') as ActionPlanStep['actionType'],
                  payload: localBase.steps[idx]?.payload,
                }))
              : localBase.steps,
          createdAt: new Date().toISOString(),
        };
      } else {
        plan = buildLocalOperatorPlan(reqText, state, attachments, clarif);
      }

      if (plan.clarificationQuestion && plan.steps.length === 0) {
        setActivePlan(plan);
      } else {
        const executed = await applyReadOnlyAndDraftSteps(plan);
        setActivePlan(executed);
        setExecutionNotice('Workflow evaluated. Read-only/draft steps ran; approval-gated steps were queued.');
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unexpected error running AI Operator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">AI Operator</h1>
          <p className="mt-1 text-sm text-slate-600">
            Instruct AIRA in plain English, attach product photos or CSV/spec files, review plans, and approve gated mutations.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {geminiAvailable === null
            ? 'Checking Gemini server status...'
            : geminiAvailable
            ? 'Server Gemini reasoning active · Demo store sandbox'
            : 'Local deterministic store inspector ready (no Gemini key configured)'}
        </div>
      </div>

      {/* Main Command Input Panel */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <label htmlFor="aira-command-input" className="block text-sm font-medium text-slate-900">
          What should AIRA inspect, draft, or prepare?
        </label>
        <textarea
          id="aira-command-input"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Example: Show me paid orders that have not shipped within two business days."
          className="w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
        />

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {attachments.map((att, idx) => (
              <div
                key={`${att.name}-${idx}`}
                className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
              >
                {att.previewUrl ? (
                  <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                )}
                <span className="max-w-[180px] truncate font-medium">{att.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-red-600"
                  aria-label={`Remove ${att.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.csv,.txt,.json,.pdf"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach Photos / CSV / Spec File
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || !prompt.trim()}
              onClick={() => runOperatorWorkflow('local_deterministic')}
              className="rounded border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              Run Local Store Inspection
            </button>
            <button
              type="button"
              disabled={loading || !prompt.trim()}
              onClick={() => runOperatorWorkflow(geminiAvailable ? 'auto' : 'local_deterministic')}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              <Send className="h-3.5 w-3.5" />
              {loading ? 'Planning...' : 'Plan & Run Permitted Steps'}
            </button>
          </div>
        </div>

        {/* Example Prompts */}
        <div className="border-t border-slate-200 pt-3">
          <p className="text-xs font-medium text-slate-500 mb-2">Example operations requests</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {EXAMPLE_OPERATOR_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setPrompt(example);
                  setClarificationAnswer('');
                }}
                className="text-left rounded border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      {apiError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">AI Request Error</p>
              <p className="mt-0.5 text-xs">{apiError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => runOperatorWorkflow('local_deterministic')}
            className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 whitespace-nowrap shrink-0"
          >
            Run Local Store Inspection Instead
          </button>
        </div>
      )}

      {executionNotice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-700 shrink-0" />
            {executionNotice}
          </span>
          <button
            type="button"
            onClick={() => onNavigate('activity')}
            className="text-blue-700 underline whitespace-nowrap"
          >
            View Activity Log
          </button>
        </div>
      )}

      {/* Structured Workflow Output */}
      {activePlan && (
        <section className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-200">
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Bot className="h-4 w-4 text-blue-600" />
              <span>Task Plan · {activePlan.createdAt.slice(0, 19).replace('T', ' ')}</span>
            </div>
            <h2 className="text-base font-semibold text-slate-900">{activePlan.understanding}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
              <div>
                <p className="font-semibold text-slate-700 mb-1">Retrieved Store Records &amp; Policies</p>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                  {activePlan.retrievedContext.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-1">Assumptions &amp; Boundaries</p>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                  {activePlan.assumptions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Focused Clarification Question when info is missing */}
          {activePlan.clarificationQuestion && activePlan.steps.length === 0 && (
            <div className="p-5 bg-amber-50/70 space-y-3">
              <p className="text-xs font-semibold text-amber-900">One focused question before proceeding</p>
              <p className="text-sm text-slate-900">{activePlan.clarificationQuestion}</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={clarificationAnswer}
                  onChange={(e) => setClarificationAnswer(e.target.value)}
                  placeholder="Provide missing details (e.g., 15% off on Studio ANC Headphones)..."
                  className="flex-1 min-w-[240px] rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!clarificationAnswer.trim()}
                  onClick={() =>
                    runOperatorWorkflow(geminiAvailable ? 'auto' : 'local_deterministic', activePlan.requestText, clarificationAnswer)
                  }
                  className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  Continue with Details
                </button>
              </div>
            </div>
          )}

          {/* Plan Steps */}
          {activePlan.steps.length > 0 && (
            <div className="divide-y divide-slate-200">
              {activePlan.steps.map((step, idx) => (
                <div key={step.id} className="p-5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs text-slate-500">0{idx + 1}.</span>
                      <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <ClassificationTag classification={step.classification} />
                      <OutcomeTag status={step.status} />
                    </div>
                  </div>

                  <p className="text-sm text-slate-600">{step.description}</p>

                  {step.affectedRecords.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Affected records: <span className="font-mono text-slate-700">{step.affectedRecords.join(', ')}</span>
                    </p>
                  )}

                  {step.resultDetail && (
                    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 leading-relaxed">
                      {step.resultDetail}
                    </div>
                  )}

                  {step.externalMessageText && (
                    <div className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-700 whitespace-pre-wrap">
                      <p className="font-semibold text-slate-900 mb-1">Drafted External Message:</p>
                      {step.externalMessageText}
                    </div>
                  )}

                  {step.blockedReason && (
                    <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-900 flex items-start gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
                      <span>{step.blockedReason}</span>
                    </div>
                  )}

                  {step.status === 'needs_approval' && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenApprovals()}
                        className="rounded bg-amber-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                      >
                        Review &amp; Approve in Queue
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
