import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { demoConnector, resetDemoConnectorGuards } from '../connectors/demoConnector';
import { createInitialDemoState, type DemoStoreState } from '../data/seedStore';
import { evaluateStepPermission } from '../domain/approvalEngine';
import type {
  ActivityEvent,
  Approval,
  ApprovalRuleSet,
  Automation,
  AutomationRun,
  Conversation,
  CustomerSegmentRule,
  NotificationPreferences,
  Order,
  Product,
  Promotion,
  ReturnRequest,
  Shipment,
  Store,
  StorePolicy,
} from '../types/domain';

const STORAGE_KEY = 'aira_demo_store_v1';

interface StoreContextValue {
  state: DemoStoreState;
  pendingApprovalsCount: number;
  resetDemoData: () => void;
  logActivity: (entry: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  queueApproval: (approval: Omit<Approval, 'id' | 'createdAt' | 'decision'>) => Approval;
  resolveApproval: (
    approvalId: string,
    decision: 'approved' | 'edited_approved' | 'cancelled',
    editedOverrides?: { newValues?: Record<string, unknown>; externalMessageText?: string }
  ) => Promise<{ ok: boolean; message: string }>;
  // Products
  upsertProduct: (product: Product, requestPublish?: boolean) => Promise<{ ok: boolean; message: string; needsApproval?: boolean }>;
  duplicateProduct: (productId: string) => void;
  archiveProduct: (productId: string) => void;
  importProductsFromCsvRows: (rows: Record<string, string>[]) => number;
  requestApplyProductTags: (productId: string, proposedTags: string[]) => Promise<{ ok: boolean; message: string }>;
  // Orders
  addOrderNote: (orderId: string, note: string) => void;
  toggleOrderException: (orderId: string, exceptionText: string | null) => void;
  requestOrderFulfillmentUpdate: (
    orderId: string,
    nextStatus: Order['fulfillmentStatus']
  ) => Promise<{ ok: boolean; message: string; needsApproval?: boolean }>;
  // Shipping
  requestPrepareShipment: (
    orderId: string,
    carrier: string,
    service: string,
    trackingNumber: string
  ) => Promise<{ ok: boolean; message: string; needsApproval?: boolean }>;
  markShipmentDeliveredDemo: (shipmentId: string) => void;
  // Customers & Inbox & Segmentation
  saveConversationDraft: (conversationId: string, draftReply: string, aiSummary?: string, classification?: Conversation['classification']) => void;
  requestSendConversationReply: (
    conversationId: string,
    messageText: string,
    isPolicyFaqOnly?: boolean
  ) => Promise<{ ok: boolean; message: string; needsApproval?: boolean }>;
  updateConversationStatus: (conversationId: string, status: Conversation['status']) => void;
  saveCustomerSegment: (segment: CustomerSegmentRule) => void;
  deleteCustomerSegment: (segmentId: string) => void;
  // Inventory
  adjustInventoryStock: (
    productId: string,
    variantId: string,
    delta: number,
    reason: string
  ) => Promise<{ ok: boolean; message: string; needsApproval?: boolean }>;
  // Returns
  saveReturnAnalysis: (returnId: string, aiSummary: string, aiDraftResponse: string) => void;
  requestReturnDecision: (
    returnId: string,
    decision: 'approved' | 'declined',
    responseNote?: string
  ) => Promise<{ ok: boolean; message: string; needsApproval?: boolean }>;
  attemptBlockedRefund: (returnId: string) => { ok: boolean; message: string };
  // Promotions
  savePromotionDraft: (promo: Promotion) => void;
  requestActivatePromotion: (promoId: string) => Promise<{ ok: boolean; message: string; needsApproval?: boolean }>;
  // Automations
  saveAutomation: (automation: Automation) => void;
  toggleAutomationStatus: (automationId: string) => void;
  runAutomation: (automationId: string, mode: 'dry_run' | 'simulated_run', simulateFailure?: boolean) => AutomationRun;
  // Settings
  updateStoreSettings: (patch: Partial<Store>) => void;
  updateStorePolicy: (policy: StorePolicy) => void;
  updateApprovalRules: (rules: ApprovalRuleSet) => void;
  updateNotifications: (prefs: NotificationPreferences) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function loadPersistedState(): DemoStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialDemoState();
    const parsed = JSON.parse(raw) as Partial<DemoStoreState>;
    const base = createInitialDemoState();
    return {
      ...base,
      ...parsed,
      store: { ...base.store, ...(parsed.store ?? {}) },
      customerSegments: parsed.customerSegments ?? base.customerSegments,
      processedActionKeys: parsed.processedActionKeys ?? [],
    };
  } catch {
    return createInitialDemoState();
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoStoreState>(loadPersistedState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [state]);

  const logActivity = useCallback((entry: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    const event: ActivityEvent = {
      ...entry,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      activityLog: [event, ...prev.activityLog],
    }));
  }, []);

  const resetDemoData = useCallback(() => {
    resetDemoConnectorGuards();
    const fresh = createInitialDemoState();
    setState(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }, []);

  const queueApproval = useCallback((approvalInput: Omit<Approval, 'id' | 'createdAt' | 'decision'>): Approval => {
    const approval: Approval = {
      ...approvalInput,
      id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      decision: 'pending',
    };
    setState((prev) => ({
      ...prev,
      approvals: [approval, ...prev.approvals],
    }));
    return approval;
  }, []);

  const applyApprovalPayload = useCallback(
    async (
      type: Approval['onApproveAction']['type'],
      payload: Record<string, unknown>,
      editedMessageText?: string
    ): Promise<{ ok: boolean; message: string }> => {
      if (type === 'issue_refund_blocked') {
        const res = await demoConnector.issueRefund(String(payload.returnId ?? ''), Number(payload.amount ?? 0));
        return { ok: false, message: res.message };
      }

      if (type === 'publish_product') {
        const productId = String(payload.productId);
        const target = state.products.find((p) => p.id === productId);
        if (!target) return { ok: false, message: 'Product not found.' };
        const res = await demoConnector.publishProduct(target, `publish:${productId}`);
        if (res.status === 'blocked') return { ok: false, message: res.message };
        setState((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId ? { ...p, status: 'published', updatedAt: new Date().toISOString() } : p
          ),
        }));
        return { ok: true, message: res.message };
      }

      if (type === 'prepare_shipment') {
        const orderId = String(payload.orderId);
        const carrier = String(payload.carrier || 'UPS (Demo)');
        const service = String(payload.service || 'Standard Ground');
        const trackingNumber = String(payload.trackingNumber || `DEMO-TRK-${Date.now().toString().slice(-6)}`);
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, message: 'Order not found.' };

        const existing = state.shipments.find((s) => s.orderId === orderId);
        const now = new Date().toISOString();
        const nextShip: Shipment = existing
          ? {
              ...existing,
              carrier,
              service,
              trackingNumber,
              trackingState: 'in_transit_demo',
              delayed: false,
              delayReason: undefined,
              preparedAt: existing.preparedAt ?? now,
              shippedAt: now,
              isSimulated: true,
            }
          : {
              id: `ship-${Date.now()}`,
              orderId,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              carrier,
              service,
              trackingNumber,
              trackingState: 'in_transit_demo',
              delayed: false,
              createdAt: order.createdAt,
              preparedAt: now,
              shippedAt: now,
              isSimulated: true,
            };

        const res = await demoConnector.prepareShipment(nextShip, `ship:${orderId}:${trackingNumber}`);
        if (res.status === 'blocked') return { ok: false, message: res.message };

        setState((prev) => ({
          ...prev,
          shipments: existing
            ? prev.shipments.map((s) => (s.id === existing.id ? nextShip : s))
            : [nextShip, ...prev.shipments],
          orders: prev.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  fulfillmentStatus: 'shipped',
                  exceptionFlag: null,
                  timeline: [
                    ...o.timeline,
                    {
                      id: `tl-${Date.now()}`,
                      timestamp: now,
                      actor: 'AIRA Fulfillment (Simulated)',
                      message: `SIMULATED: Marked shipped via ${carrier} (${service}), tracking ${trackingNumber}.`,
                      isSimulated: true,
                    },
                  ],
                }
              : o
          ),
        }));
        return { ok: true, message: res.message };
      }

      if (type === 'update_order_status') {
        const orderId = String(payload.orderId);
        const nextStatus = payload.nextStatus as Order['fulfillmentStatus'];
        const now = new Date().toISOString();
        setState((prev) => ({
          ...prev,
          orders: prev.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  fulfillmentStatus: nextStatus,
                  timeline: [
                    ...o.timeline,
                    {
                      id: `tl-${Date.now()}`,
                      timestamp: now,
                      actor: 'Merchant Approved (Demo)',
                      message: `SIMULATED: Fulfillment status updated to "${nextStatus}".`,
                      isSimulated: true,
                    },
                  ],
                }
              : o
          ),
        }));
        return { ok: true, message: `SIMULATED: Order status updated to "${nextStatus}".` };
      }

      if (type === 'send_customer_reply') {
        const conversationId = String(payload.conversationId);
        const body = editedMessageText ?? String(payload.messageText ?? '');
        const res = await demoConnector.sendCustomerMessage(
          conversationId,
          body,
          `msg:${conversationId}:${body.slice(0, 24)}`
        );
        if (res.status === 'blocked') return { ok: false, message: res.message };
        const now = new Date().toISOString();
        setState((prev) => ({
          ...prev,
          conversations: prev.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  status: 'waiting',
                  draftReply: undefined,
                  updatedAt: now,
                  messages: [
                    ...c.messages,
                    {
                      id: `msg-${Date.now()}`,
                      conversationId,
                      sender: 'merchant',
                      senderName: 'Store Ops (Simulated Demo)',
                      body,
                      timestamp: now,
                      isSimulated: true,
                    },
                  ],
                }
              : c
          ),
        }));
        return { ok: true, message: res.message };
      }

      if (type === 'review_return') {
        const returnId = String(payload.returnId);
        const decision = payload.decision as 'approved' | 'declined';
        const target = state.returns.find((r) => r.id === returnId);
        if (!target) return { ok: false, message: 'Return request not found.' };
        const res = await demoConnector.processReturnDecision(target, decision, `ret:${returnId}:${decision}`);
        if (res.status === 'blocked') return { ok: false, message: res.message };
        const now = new Date().toISOString();
        setState((prev) => ({
          ...prev,
          returns: prev.returns.map((r) =>
            r.id === returnId
              ? {
                  ...r,
                  status: decision === 'approved' ? 'approved_simulated' : 'declined_simulated',
                  timeline: [
                    ...r.timeline,
                    {
                      id: `rt-${Date.now()}`,
                      timestamp: now,
                      actor: 'Merchant Approved (Demo)',
                      note: `SIMULATED: Return ${decision}. ${editedMessageText ? `Note: ${editedMessageText}` : 'No real refund issued.'}`,
                      isSimulated: true,
                    },
                  ],
                }
              : r
          ),
        }));
        return { ok: true, message: res.message };
      }

      if (type === 'apply_promotion') {
        const promoId = String(payload.promoId);
        setState((prev) => ({
          ...prev,
          promotions: prev.promotions.map((p) => (p.id === promoId ? { ...p, status: 'active_demo' } : p)),
        }));
        return { ok: true, message: 'SIMULATED: Promotion activated in Demo Store.' };
      }

      if (type === 'adjust_inventory') {
        const productId = String(payload.productId);
        const variantId = String(payload.variantId);
        const delta = Number(payload.delta);
        const reason = String(payload.reason);
        const prod = state.products.find((p) => p.id === productId);
        const variant = prod?.variants.find((v) => v.id === variantId);
        if (!prod || !variant) return { ok: false, message: 'Variant not found.' };
        const previousStock = variant.stock;
        const newStock = Math.max(0, previousStock + delta);
        const now = new Date().toISOString();
        setState((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  updatedAt: now,
                  variants: p.variants.map((v) => (v.id === variantId ? { ...v, stock: newStock } : v)),
                }
              : p
          ),
          inventoryEvents: [
            {
              id: `inv-${Date.now()}`,
              productId,
              variantId,
              sku: variant.sku,
              productTitle: prod.title,
              variantTitle: variant.title,
              delta: newStock - previousStock,
              previousStock,
              newStock,
              reason,
              actor: 'Merchant Approved (Demo)',
              isSimulated: true,
              timestamp: now,
            },
            ...prev.inventoryEvents,
          ],
        }));
        return { ok: true, message: `SIMULATED: Stock for ${variant.sku} adjusted ${previousStock} -> ${newStock}.` };
      }

      if (type === 'create_product_draft' && payload.productId && Array.isArray(payload.tags)) {
        const productId = String(payload.productId);
        const tags = (payload.tags as unknown[]).map(String);
        setState((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId ? { ...p, tags, updatedAt: new Date().toISOString() } : p
          ),
        }));
        return { ok: true, message: `Applied ${tags.length} approved tags to product.` };
      }

      return { ok: false, message: 'Unsupported approval action type.' };
    },
    [state.orders, state.products, state.returns, state.shipments]
  );

  const resolveApproval = useCallback(
    async (
      approvalId: string,
      decision: 'approved' | 'edited_approved' | 'cancelled',
      editedOverrides?: { newValues?: Record<string, unknown>; externalMessageText?: string }
    ): Promise<{ ok: boolean; message: string }> => {
      const approval = state.approvals.find((a) => a.id === approvalId);
      if (!approval) return { ok: false, message: 'Approval record not found.' };
      if (approval.decision !== 'pending') {
        return { ok: false, message: `Duplicate guard: approval already resolved as "${approval.decision}".` };
      }

      const now = new Date().toISOString();

      if (decision === 'cancelled') {
        setState((prev) => ({
          ...prev,
          approvals: prev.approvals.map((a) =>
            a.id === approvalId ? { ...a, decision: 'cancelled', decidedAt: now } : a
          ),
        }));
        logActivity({
          actor: 'Merchant User',
          actionSummary: `Cancelled approval: ${approval.title}`,
          targetRecords: approval.affectedRecords,
          classification: approval.classification,
          result: 'cancelled',
          approvalDecision: 'cancelled',
          beforeValue: approval.oldValues,
          afterValue: null,
          isSimulated: true,
        });
        return { ok: true, message: 'Action cancelled; no store changes were applied.' };
      }

      if (state.processedActionKeys.includes(approval.duplicateKey)) {
        return { ok: false, message: 'Duplicate-action guard blocked repeating this action.' };
      }

      const mergedPayload = {
        ...approval.onApproveAction.payload,
        ...(editedOverrides?.newValues ?? {}),
      };
      const outcome = await applyApprovalPayload(
        approval.onApproveAction.type,
        mergedPayload,
        editedOverrides?.externalMessageText
      );

      setState((prev) => ({
        ...prev,
        processedActionKeys: [...prev.processedActionKeys, approval.duplicateKey],
        approvals: prev.approvals.map((a) =>
          a.id === approvalId
            ? {
                ...a,
                decision,
                decidedAt: now,
                newValues: editedOverrides?.newValues ?? a.newValues,
                externalMessageText: editedOverrides?.externalMessageText ?? a.externalMessageText,
              }
            : a
        ),
      }));

      logActivity({
        actor: 'Merchant User',
        actionSummary: `${decision === 'edited_approved' ? 'Edited & approved' : 'Approved'}: ${approval.title}`,
        targetRecords: approval.affectedRecords,
        classification: approval.classification,
        result: outcome.ok ? 'simulated' : 'blocked',
        approvalDecision: decision === 'edited_approved' ? 'edited_and_approved' : 'approved_by_user',
        beforeValue: approval.oldValues,
        afterValue: editedOverrides?.newValues ?? approval.newValues,
        isSimulated: true,
      });

      return outcome;
    },
    [applyApprovalPayload, logActivity, state.approvals, state.processedActionKeys]
  );

  const upsertProduct = useCallback(
    async (
      product: Product,
      requestPublish = false
    ): Promise<{ ok: boolean; message: string; needsApproval?: boolean }> => {
      const now = new Date().toISOString();
      const exists = state.products.some((p) => p.id === product.id);
      const draftProduct: Product = {
        ...product,
        status: product.status === 'archived' ? 'archived' : 'draft',
        updatedAt: now,
      };

      setState((prev) => ({
        ...prev,
        products: exists
          ? prev.products.map((p) => (p.id === product.id ? draftProduct : p))
          : [draftProduct, ...prev.products],
      }));

      logActivity({
        actor: 'Merchant User',
        actionSummary: `${exists ? 'Updated' : 'Created'} product draft "${product.title}"`,
        targetRecords: [product.variants[0]?.sku ?? product.id, product.title],
        classification: 'draft',
        result: 'simulated',
        approvalDecision: 'auto_permitted',
        afterValue: { status: draftProduct.status, category: draftProduct.category },
        isSimulated: true,
      });

      if (requestPublish) {
        const perm = evaluateStepPermission(
          { actionType: 'publish_product', classification: 'consequential_external' },
          state.store.approvalRules
        );
        if (perm.decision === 'needs_approval') {
          queueApproval({
            source: 'manual_workflow',
            title: `Publish product "${product.title}" (Demo)`,
            actionDescription: 'Change listing status from Draft to Published in Demo Store catalog.',
            classification: 'consequential_external',
            affectedRecords: [product.title, product.variants[0]?.sku ?? product.id],
            oldValues: { status: 'draft' },
            newValues: { status: 'published' },
            riskNote: 'Demo Store only — publishing does not list on a real external storefront.',
            missingInformation: product.unverifiedFields,
            duplicateKey: `publish:${product.id}:${Date.now()}`,
            onApproveAction: { type: 'publish_product', payload: { productId: product.id } },
          });
          return { ok: true, needsApproval: true, message: 'Saved as Draft. Publish request queued for approval.' };
        }
        const pubRes = await demoConnector.publishProduct(draftProduct, `publish:${product.id}:${Date.now()}`);
        setState((prev) => ({
          ...prev,
          products: prev.products.map((p) => (p.id === product.id ? { ...p, status: 'published' } : p)),
        }));
        return { ok: true, message: pubRes.message };
      }

      return { ok: true, message: `Saved "${product.title}" as Draft in demo catalog.` };
    },
    [logActivity, queueApproval, state.products, state.store.approvalRules]
  );

  const duplicateProduct = useCallback(
    (productId: string) => {
      const source = state.products.find((p) => p.id === productId);
      if (!source) return;
      const now = new Date().toISOString();
      const newId = `prod-${Date.now()}`;
      const clone: Product = {
        ...source,
        id: newId,
        title: `${source.title} (Copy)`,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        variants: source.variants.map((v, idx) => ({
          ...v,
          id: `var-${Date.now()}-${idx}`,
          productId: newId,
          sku: `${v.sku}-COPY`,
          reserved: 0,
        })),
      };
      setState((prev) => ({ ...prev, products: [clone, ...prev.products] }));
      logActivity({
        actor: 'Merchant User',
        actionSummary: `Duplicated "${source.title}" as Draft`,
        targetRecords: [source.id, newId],
        classification: 'draft',
        result: 'simulated',
        approvalDecision: 'auto_permitted',
        isSimulated: true,
      });
    },
    [logActivity, state.products]
  );

  const archiveProduct = useCallback(
    (productId: string) => {
      const target = state.products.find((p) => p.id === productId);
      if (!target) return;
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === productId ? { ...p, status: 'archived', updatedAt: new Date().toISOString() } : p
        ),
      }));
      logActivity({
        actor: 'Merchant User',
        actionSummary: `Archived "${target.title}" in demo catalog`,
        targetRecords: [target.title],
        classification: 'reversible_change',
        result: 'simulated',
        approvalDecision: 'approved_by_user',
        beforeValue: { status: target.status },
        afterValue: { status: 'archived' },
        isSimulated: true,
      });
    },
    [logActivity, state.products]
  );

  const importProductsFromCsvRows = useCallback(
    (rows: Record<string, string>[]): number => {
      const now = new Date().toISOString();
      const created: Product[] = [];
      rows.forEach((row, idx) => {
        const title = row.title || row.Title || row.name || row.Name;
        if (!title) return;
        const priceNum = Number(row.price || row.Price || 0);
        const stockNum = Number(row.stock || row.Stock || row.inventory || 0);
        const sku = row.sku || row.SKU || `IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;
        const prodId = `prod-imp-${Date.now()}-${idx}`;
        const missing: string[] = [];
        if (!row.price && !row.Price) missing.push('price');
        if (!row.sku && !row.SKU) missing.push('sku');
        created.push({
          id: prodId,
          title,
          description: row.description || row.Description || 'Imported from CSV — review and complete description before publishing.',
          category: (row.category || row.Category || 'Electronics') as Product['category'],
          fulfillmentType: 'physical',
          status: 'draft',
          tags: (row.tags || row.Tags || '').split(/[;|,]/).map((t) => t.trim()).filter(Boolean),
          taxable: true,
          requiresShipping: true,
          unverifiedFields: missing.length > 0 ? missing : undefined,
          variants: [
            {
              id: `var-imp-${Date.now()}-${idx}`,
              productId: prodId,
              sku,
              title: row.variant || row.Variant || 'Standard',
              attributes: row.material ? { Material: row.material } : { Source: 'CSV Import' },
              price: Number.isFinite(priceNum) ? priceNum : 0,
              unitCost: row.cost ? Number(row.cost) : null,
              stock: Number.isFinite(stockNum) ? stockNum : 0,
              reserved: 0,
              lowStockThreshold: 5,
            },
          ],
          createdAt: now,
          updatedAt: now,
        });
      });

      if (created.length > 0) {
        setState((prev) => ({ ...prev, products: [...created, ...prev.products] }));
        logActivity({
          actor: 'Merchant User',
          actionSummary: `Imported ${created.length} product draft(s) from CSV (SIMULATED)`,
          targetRecords: created.map((c) => c.title),
          classification: 'draft',
          result: 'simulated',
          approvalDecision: 'auto_permitted',
          isSimulated: true,
        });
      }
      return created.length;
    },
    [logActivity]
  );

  const requestApplyProductTags = useCallback(
    async (productId: string, proposedTags: string[]): Promise<{ ok: boolean; message: string }> => {
      const product = state.products.find((p) => p.id === productId);
      if (!product) return { ok: false, message: 'Product not found.' };
      const cleaned = Array.from(new Set(proposedTags.map((t) => t.trim().toLowerCase()).filter(Boolean)));
      queueApproval({
        source: 'operator',
        title: `Apply AI-suggested tags to "${product.title}"`,
        actionDescription: 'Review and approve categorized AI tag suggestions before updating the product catalog record.',
        classification: 'reversible_change',
        affectedRecords: [product.title, product.variants[0]?.sku ?? product.id],
        oldValues: { tags: product.tags },
        newValues: { tags: cleaned },
        riskNote: 'Tags will only be applied to the demo product after you approve.',
        duplicateKey: `tags:${product.id}:${cleaned.join(',')}:${Date.now()}`,
        onApproveAction: {
          type: 'create_product_draft',
          payload: { productId: product.id, tags: cleaned },
        },
      });
      return { ok: true, message: 'Suggested tags queued for review and approval.' };
    },
    [queueApproval, state.products]
  );

  const addOrderNote = useCallback(
    (orderId: string, note: string) => {
      const trimmed = note.trim();
      if (!trimmed) return;
      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                notes: [...o.notes, trimmed],
                timeline: [
                  ...o.timeline,
                  { id: `tl-${Date.now()}`, timestamp: now, actor: 'Merchant User', message: `Note added: "${trimmed}"`, isSimulated: true },
                ],
              }
            : o
        ),
      }));
      logActivity({
        actor: 'Merchant User',
        actionSummary: `Added note to order ${orderId}`,
        targetRecords: [orderId],
        classification: 'reversible_change',
        result: 'simulated',
        approvalDecision: 'auto_permitted',
        afterValue: { note: trimmed },
        isSimulated: true,
      });
    },
    [logActivity]
  );

  const toggleOrderException = useCallback(
    (orderId: string, exceptionText: string | null) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return;
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? { ...o, exceptionFlag: exceptionText } : o)),
      }));
      logActivity({
        actor: 'Merchant User',
        actionSummary: exceptionText
          ? `Flagged exception on ${order.orderNumber}: ${exceptionText}`
          : `Cleared exception flag on ${order.orderNumber}`,
        targetRecords: [order.orderNumber],
        classification: 'reversible_change',
        result: 'simulated',
        approvalDecision: 'auto_permitted',
        beforeValue: { exceptionFlag: order.exceptionFlag },
        afterValue: { exceptionFlag: exceptionText },
        isSimulated: true,
      });
    },
    [logActivity, state.orders]
  );

  const requestOrderFulfillmentUpdate = useCallback(
    async (
      orderId: string,
      nextStatus: Order['fulfillmentStatus']
    ): Promise<{ ok: boolean; message: string; needsApproval?: boolean }> => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, message: 'Order not found.' };

      const perm = evaluateStepPermission(
        { actionType: 'update_order_status', classification: 'consequential_external' },
        state.store.approvalRules
      );
      if (perm.decision === 'needs_approval') {
        queueApproval({
          source: 'manual_workflow',
          title: `Update ${order.orderNumber} fulfillment status to "${nextStatus}"`,
          actionDescription: `Change order ${order.orderNumber} (${order.customerName}) from ${order.fulfillmentStatus} to ${nextStatus}.`,
          classification: 'consequential_external',
          affectedRecords: [order.orderNumber, order.customerName],
          oldValues: { fulfillmentStatus: order.fulfillmentStatus },
          newValues: { fulfillmentStatus: nextStatus },
          riskNote: 'Simulated in Demo Store. Does not trigger a real carrier dispatch or payment refund.',
          duplicateKey: `order-status:${orderId}:${nextStatus}:${Date.now()}`,
          onApproveAction: { type: 'update_order_status', payload: { orderId, nextStatus } },
        });
        return { ok: true, needsApproval: true, message: 'Status update queued for approval.' };
      }

      const res = await applyApprovalPayload('update_order_status', { orderId, nextStatus });
      return res;
    },
    [applyApprovalPayload, queueApproval, state.orders, state.store.approvalRules]
  );

  const requestPrepareShipment = useCallback(
    async (
      orderId: string,
      carrier: string,
      service: string,
      trackingNumber: string
    ): Promise<{ ok: boolean; message: string; needsApproval?: boolean }> => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, message: 'Order not found.' };
      if (!carrier.trim() || !trackingNumber.trim()) {
        return { ok: false, message: 'Carrier and tracking number are required—never guess a shipment.' };
      }

      const perm = evaluateStepPermission(
        { actionType: 'prepare_shipment', classification: 'consequential_external' },
        state.store.approvalRules
      );

      if (perm.decision === 'needs_approval') {
        queueApproval({
          source: 'manual_workflow',
          title: `Prepare & dispatch demo shipment for ${order.orderNumber}`,
          actionDescription: `Attach tracking ${trackingNumber} (${carrier} · ${service}) and mark ${order.orderNumber} as shipped in Demo Store.`,
          classification: 'consequential_external',
          affectedRecords: [order.orderNumber, order.customerName],
          oldValues: { fulfillmentStatus: order.fulfillmentStatus, trackingNumber: 'None' },
          newValues: { fulfillmentStatus: 'shipped (demo)', carrier, service, trackingNumber },
          riskNote: 'Demo simulation only — no real carrier label is purchased or transmitted.',
          duplicateKey: `ship:${orderId}:${trackingNumber}:${Date.now()}`,
          onApproveAction: {
            type: 'prepare_shipment',
            payload: { orderId, carrier, service, trackingNumber },
          },
        });
        return { ok: true, needsApproval: true, message: 'Shipment preparation queued for approval.' };
      }

      return applyApprovalPayload('prepare_shipment', { orderId, carrier, service, trackingNumber });
    },
    [applyApprovalPayload, queueApproval, state.orders, state.store.approvalRules]
  );

  const markShipmentDeliveredDemo = useCallback(
    (shipmentId: string) => {
      const target = state.shipments.find((s) => s.id === shipmentId);
      if (!target) return;
      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        shipments: prev.shipments.map((s) =>
          s.id === shipmentId ? { ...s, trackingState: 'delivered_demo', delayed: false, delayReason: undefined } : s
        ),
        orders: prev.orders.map((o) =>
          o.id === target.orderId
            ? {
                ...o,
                fulfillmentStatus: 'delivered',
                exceptionFlag: null,
                timeline: [
                  ...o.timeline,
                  { id: `tl-${Date.now()}`, timestamp: now, actor: 'Tracking Sync (Demo)', message: 'SIMULATED: Marked delivered in demo.', isSimulated: true },
                ],
              }
            : o
        ),
      }));
      logActivity({
        actor: 'Merchant User',
        actionSummary: `Marked shipment ${target.trackingNumber || target.orderNumber} delivered (SIMULATED)`,
        targetRecords: [target.orderNumber],
        classification: 'reversible_change',
        result: 'simulated',
        approvalDecision: 'approved_by_user',
        isSimulated: true,
      });
    },
    [logActivity, state.shipments]
  );

  const saveConversationDraft = useCallback(
    (
      conversationId: string,
      draftReply: string,
      aiSummary?: string,
      classification?: Conversation['classification']
    ) => {
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                draftReply,
                aiSummary: aiSummary ?? c.aiSummary,
                classification: classification ?? c.classification,
              }
            : c
        ),
      }));
    },
    []
  );

  const requestSendConversationReply = useCallback(
    async (
      conversationId: string,
      messageText: string,
      isPolicyFaqOnly = false
    ): Promise<{ ok: boolean; message: string; needsApproval?: boolean }> => {
      const conv = state.conversations.find((c) => c.id === conversationId);
      if (!conv) return { ok: false, message: 'Conversation not found.' };
      if (!messageText.trim()) return { ok: false, message: 'Reply text cannot be empty.' };

      const perm = evaluateStepPermission(
        {
          actionType: 'send_customer_reply',
          classification: 'consequential_external',
          payload: { isPolicyFaqOnly },
        },
        state.store.approvalRules
      );

      if (perm.decision === 'needs_approval') {
        queueApproval({
          source: 'manual_workflow',
          title: `Send reply to ${conv.customerName} (${conv.orderNumber ?? conv.subject})`,
          actionDescription: 'Review customer-facing message before simulated dispatch in Demo Store.',
          classification: 'consequential_external',
          affectedRecords: [conv.customerName, conv.orderNumber ?? conv.id],
          oldValues: { status: conv.status },
          newValues: { status: 'waiting', simulatedSend: true },
          externalMessageText: messageText,
          riskNote: 'Customer-facing communication. Simulated in Demo Store — no real email is sent.',
          duplicateKey: `reply:${conversationId}:${Date.now()}`,
          onApproveAction: {
            type: 'send_customer_reply',
            payload: { conversationId, messageText, isPolicyFaqOnly },
          },
        });
        return { ok: true, needsApproval: true, message: 'Draft reply submitted for approval before sending.' };
      }

      const res = await applyApprovalPayload('send_customer_reply', { conversationId, messageText });
      logActivity({
        actor: 'AIRA Operator',
        actionSummary: `Auto-sent policy FAQ reply (SIMULATED) to ${conv.customerName}`,
        targetRecords: [conv.customerName],
        classification: 'consequential_external',
        result: 'simulated',
        approvalDecision: 'auto_permitted',
        afterValue: { messageText },
        isSimulated: true,
      });
      return res;
    },
    [applyApprovalPayload, logActivity, queueApproval, state.conversations, state.store.approvalRules]
  );

  const updateConversationStatus = useCallback((conversationId: string, status: Conversation['status']) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId ? { ...c, status, updatedAt: new Date().toISOString() } : c
      ),
    }));
  }, []);

  const saveCustomerSegment = useCallback(
    (segment: CustomerSegmentRule) => {
      setState((prev) => {
        const exists = prev.customerSegments.some((s) => s.id === segment.id);
        return {
          ...prev,
          customerSegments: exists
            ? prev.customerSegments.map((s) => (s.id === segment.id ? segment : s))
            : [segment, ...prev.customerSegments],
        };
      });
      logActivity({
        actor: 'Merchant User',
        actionSummary: `Saved customer segment "${segment.name}"`,
        targetRecords: [segment.name],
        classification: 'reversible_change',
        result: 'simulated',
        approvalDecision: 'auto_permitted',
        afterValue: segment,
        isSimulated: true,
      });
    },
    [logActivity]
  );

  const deleteCustomerSegment = useCallback((segmentId: string) => {
    setState((prev) => ({
      ...prev,
      customerSegments: prev.customerSegments.filter((s) => s.id !== segmentId),
    }));
  }, []);

  const adjustInventoryStock = useCallback(
    async (
      productId: string,
      variantId: string,
      delta: number,
      reason: string
    ): Promise<{ ok: boolean; message: string; needsApproval?: boolean }> => {
      if (!reason.trim()) {
        return { ok: false, message: 'A reason is required for every inventory adjustment.' };
      }
      const prod = state.products.find((p) => p.id === productId);
      const variant = prod?.variants.find((v) => v.id === variantId);
      if (!prod || !variant) return { ok: false, message: 'Variant not found.' };

      const isLarge = Math.abs(delta) >= 25;
      const perm = evaluateStepPermission(
        {
          actionType: 'adjust_inventory',
          classification: 'reversible_change',
          payload: { isBulk: isLarge },
        },
        state.store.approvalRules
      );

      if (isLarge && perm.decision === 'needs_approval') {
        queueApproval({
          source: 'manual_workflow',
          title: `Large stock adjustment (${delta > 0 ? `+${delta}` : delta}) for ${variant.sku}`,
          actionDescription: `Adjust stock on ${prod.title} (${variant.title}) with reason: "${reason}".`,
          classification: 'reversible_change',
          affectedRecords: [variant.sku, prod.title],
          oldValues: { stock: variant.stock },
          newValues: { stock: Math.max(0, variant.stock + delta), reason },
          duplicateKey: `inv:${variantId}:${delta}:${Date.now()}`,
          onApproveAction: {
            type: 'adjust_inventory',
            payload: { productId, variantId, delta, reason },
          },
        });
        return { ok: true, needsApproval: true, message: 'Large stock adjustment queued for approval.' };
      }

      const res = await applyApprovalPayload('adjust_inventory', { productId, variantId, delta, reason });
      if (res.ok) {
        logActivity({
          actor: 'Merchant User',
          actionSummary: `Adjusted stock for ${variant.sku} by ${delta > 0 ? `+${delta}` : delta} (${reason})`,
          targetRecords: [variant.sku, prod.title],
          classification: 'reversible_change',
          result: 'simulated',
          approvalDecision: 'auto_permitted',
          beforeValue: { stock: variant.stock },
          afterValue: { stock: Math.max(0, variant.stock + delta), reason },
          isSimulated: true,
        });
      }
      return res;
    },
    [applyApprovalPayload, logActivity, queueApproval, state.products, state.store.approvalRules]
  );

  const saveReturnAnalysis = useCallback((returnId: string, aiSummary: string, aiDraftResponse: string) => {
    setState((prev) => ({
      ...prev,
      returns: prev.returns.map((r) => (r.id === returnId ? { ...r, aiSummary, aiDraftResponse } : r)),
    }));
  }, []);

  const requestReturnDecision = useCallback(
    async (
      returnId: string,
      decision: 'approved' | 'declined',
      responseNote?: string
    ): Promise<{ ok: boolean; message: string; needsApproval?: boolean }> => {
      const target = state.returns.find((r) => r.id === returnId);
      if (!target) return { ok: false, message: 'Return request not found.' };

      const perm = evaluateStepPermission(
        { actionType: 'review_return', classification: 'consequential_external' },
        state.store.approvalRules
      );

      if (perm.decision === 'needs_approval') {
        queueApproval({
          source: 'manual_workflow',
          title: `${decision === 'approved' ? 'Approve' : 'Decline'} return ${target.returnNumber} (Demo)`,
          actionDescription: `Record simulated return decision for ${target.orderNumber} (${target.customerName}).`,
          classification: 'consequential_external',
          affectedRecords: [target.returnNumber, target.orderNumber, target.customerName],
          oldValues: { status: target.status },
          newValues: { status: decision === 'approved' ? 'approved_simulated' : 'declined_simulated' },
          externalMessageText: responseNote ?? target.aiDraftResponse,
          riskNote: 'Demo simulation only — approving a return here does NOT issue a real payment refund.',
          missingInformation: target.evidenceAttached ? [] : ['Photo evidence has not yet been attached by customer.'],
          duplicateKey: `ret:${returnId}:${decision}:${Date.now()}`,
          onApproveAction: { type: 'review_return', payload: { returnId, decision } },
        });
        return { ok: true, needsApproval: true, message: 'Return decision queued for approval.' };
      }

      return applyApprovalPayload('review_return', { returnId, decision }, responseNote);
    },
    [applyApprovalPayload, queueApproval, state.returns, state.store.approvalRules]
  );

  const attemptBlockedRefund = useCallback(
    (returnId: string): { ok: boolean; message: string } => {
      const target = state.returns.find((r) => r.id === returnId);
      const msg =
        'BLOCKED: Real payment refunds cannot be issued in Demo Store mode and remain disabled unless explicit refund authorization and a live payment connector are configured.';
      logActivity({
        actor: 'System Guard',
        actionSummary: `Blocked refund attempt for ${target?.returnNumber ?? returnId}`,
        targetRecords: target ? [target.returnNumber, target.orderNumber] : [returnId],
        classification: 'consequential_external',
        result: 'blocked',
        approvalDecision: 'blocked_by_policy',
        isSimulated: true,
      });
      return { ok: false, message: msg };
    },
    [logActivity, state.returns]
  );

  const savePromotionDraft = useCallback(
    (promo: Promotion) => {
      setState((prev) => {
        const exists = prev.promotions.some((p) => p.id === promo.id);
        return {
          ...prev,
          promotions: exists
            ? prev.promotions.map((p) => (p.id === promo.id ? { ...promo, status: 'draft' } : p))
            : [{ ...promo, status: 'draft' }, ...prev.promotions],
        };
      });
      logActivity({
        actor: 'Merchant User',
        actionSummary: `Saved promotion draft "${promo.name}" (${promo.code})`,
        targetRecords: [promo.code, promo.name],
        classification: 'draft',
        result: 'simulated',
        approvalDecision: 'auto_permitted',
        isSimulated: true,
      });
    },
    [logActivity]
  );

  const requestActivatePromotion = useCallback(
    async (promoId: string): Promise<{ ok: boolean; message: string; needsApproval?: boolean }> => {
      const promo = state.promotions.find((p) => p.id === promoId);
      if (!promo) return { ok: false, message: 'Promotion not found.' };
      const perm = evaluateStepPermission(
        { actionType: 'apply_promotion', classification: 'consequential_external' },
        state.store.approvalRules
      );
      if (perm.decision === 'needs_approval') {
        queueApproval({
          source: 'manual_workflow',
          title: `Activate promotion "${promo.name}" (${promo.code})`,
          actionDescription: `Apply ${promo.discountType === 'percentage' ? `${promo.discountValue}%` : `$${promo.discountValue}`} discount in Demo Store.`,
          classification: 'consequential_external',
          affectedRecords: [promo.code, promo.name],
          oldValues: { status: promo.status },
          newValues: { status: 'active_demo', startAt: promo.startAt, endAt: promo.endAt },
          riskNote: 'Simulated in Demo Store. Review affected products and date window before applying.',
          duplicateKey: `promo:${promoId}:${Date.now()}`,
          onApproveAction: { type: 'apply_promotion', payload: { promoId } },
        });
        return { ok: true, needsApproval: true, message: 'Promotion activation queued for review and approval.' };
      }
      return applyApprovalPayload('apply_promotion', { promoId });
    },
    [applyApprovalPayload, queueApproval, state.promotions, state.store.approvalRules]
  );

  const saveAutomation = useCallback(
    (automation: Automation) => {
      setState((prev) => {
        const exists = prev.automations.some((a) => a.id === automation.id);
        // New automations ALWAYS start paused until user reviews and enables them
        const normalized: Automation = exists ? automation : { ...automation, status: 'paused' };
        return {
          ...prev,
          automations: exists
            ? prev.automations.map((a) => (a.id === normalized.id ? normalized : a))
            : [normalized, ...prev.automations],
        };
      });
      logActivity({
        actor: 'Merchant User',
        actionSummary: `Saved automation "${automation.name}" (status: ${automation.status})`,
        targetRecords: [automation.name],
        classification: 'draft',
        result: 'simulated',
        approvalDecision: 'auto_permitted',
        isSimulated: true,
      });
    },
    [logActivity]
  );

  const toggleAutomationStatus = useCallback(
    (automationId: string) => {
      const target = state.automations.find((a) => a.id === automationId);
      if (!target) return;
      const nextStatus: Automation['status'] = target.status === 'active' ? 'paused' : 'active';
      setState((prev) => ({
        ...prev,
        automations: prev.automations.map((a) =>
          a.id === automationId ? { ...a, status: nextStatus, lastError: undefined } : a
        ),
      }));
      logActivity({
        actor: 'Merchant User',
        actionSummary: `${nextStatus === 'active' ? 'Resumed' : 'Paused'} automation "${target.name}"`,
        targetRecords: [target.name],
        classification: 'reversible_change',
        result: 'simulated',
        approvalDecision: 'approved_by_user',
        beforeValue: { status: target.status },
        afterValue: { status: nextStatus },
        isSimulated: true,
      });
    },
    [logActivity, state.automations]
  );

  const runAutomation = useCallback(
    (automationId: string, mode: 'dry_run' | 'simulated_run', simulateFailure = false): AutomationRun => {
      const target = state.automations.find((a) => a.id === automationId);
      const now = new Date().toISOString();
      if (!target) {
        return {
          id: `run-${Date.now()}`,
          automationId,
          automationName: 'Unknown',
          startedAt: now,
          finishedAt: now,
          mode,
          status: 'failed',
          simulated: true,
          inputsSummary: 'Missing automation record',
          stepsExecuted: [],
          approvalsTriggered: [],
          resultSummary: 'Automation not found.',
          errorMessage: 'Automation ID not found.',
          retryCount: 0,
        };
      }

      if (simulateFailure) {
        const retries = target.retryOnSafeFailure ? 2 : 0;
        const failedRun: AutomationRun = {
          id: `run-${Date.now()}`,
          automationId,
          automationName: target.name,
          startedAt: now,
          finishedAt: now,
          mode,
          status: 'failed',
          simulated: true,
          inputsSummary: `${target.scheduleOrSource} (${mode === 'dry_run' ? 'Dry Run' : 'Simulated Run'})`,
          stepsExecuted: target.steps.map((s, idx) => ({
            stepTitle: s.title,
            classification: s.classification,
            outcome: idx === 0 ? 'completed' : 'failed',
            detail:
              idx === 0
                ? 'SIMULATED: Input check passed.'
                : `Simulated transient connector timeout after ${retries} safe retry attempt(s).`,
          })),
          approvalsTriggered: [],
          resultSummary: `SIMULATED ERROR: Halted safely after ${retries} retry attempt(s); no duplicate mutations occurred.`,
          errorMessage: 'Simulated transient timeout on step 2.',
          retryCount: retries,
        };
        setState((prev) => ({
          ...prev,
          automations: prev.automations.map((a) =>
            a.id === automationId
              ? { ...a, status: 'error', lastError: failedRun.errorMessage, lastRunAt: now, runHistory: [failedRun, ...a.runHistory] }
              : a
          ),
        }));
        logActivity({
          actor: 'AIRA Automation',
          actionSummary: `Automation "${target.name}" failed safely in ${mode} (SIMULATED)`,
          targetRecords: [target.name],
          classification: 'read_only',
          result: 'failed',
          approvalDecision: 'not_applicable',
          isSimulated: true,
        });
        return failedRun;
      }

      const approvalsTriggered: string[] = [];
      const stepsExecuted = target.steps.map((s) => {
        const needsReview =
          mode === 'simulated_run' &&
          s.classification === 'consequential_external' &&
          target.approvalPolicy !== 'narrow_rule_auto';
        if (needsReview) {
          approvalsTriggered.push(s.title);
        }
        return {
          stepTitle: s.title,
          classification: s.classification,
          outcome: needsReview ? ('needs_approval' as const) : ('simulated' as const),
          detail:
            mode === 'dry_run'
              ? `SIMULATED DRY-RUN: Verified preconditions for "${s.title}" without writing changes.`
              : needsReview
              ? `SIMULATED: Paused for owner approval before executing "${s.title}".`
              : `SIMULATED: Executed "${s.title}" inside Demo Store sandbox.`,
        };
      });

      const run: AutomationRun = {
        id: `run-${Date.now()}`,
        automationId,
        automationName: target.name,
        startedAt: now,
        finishedAt: now,
        mode,
        status: approvalsTriggered.length > 0 ? 'needs_approval' : 'completed_simulated',
        simulated: true,
        inputsSummary: `Trigger: ${target.trigger} · Mode: ${mode === 'dry_run' ? 'Dry Run (No Writes)' : 'Simulated Run'}`,
        stepsExecuted,
        approvalsTriggered,
        resultSummary:
          mode === 'dry_run'
            ? `SIMULATED DRY-RUN: Validated ${stepsExecuted.length} step(s) with duplicate guard (${target.duplicateGuardWindowMinutes}m window).`
            : `SIMULATED: Completed ${stepsExecuted.length} step(s)${approvalsTriggered.length ? `; ${approvalsTriggered.length} gated for approval` : ''}.`,
        retryCount: 0,
      };

      setState((prev) => ({
        ...prev,
        automations: prev.automations.map((a) =>
          a.id === automationId ? { ...a, lastRunAt: now, lastError: undefined, runHistory: [run, ...a.runHistory] } : a
        ),
      }));

      logActivity({
        actor: 'AIRA Automation',
        actionSummary: `${mode === 'dry_run' ? 'Dry-ran' : 'Ran'} "${target.name}" (SIMULATED)`,
        targetRecords: [target.name],
        classification: 'draft',
        result: 'simulated',
        approvalDecision: approvalsTriggered.length > 0 ? 'pending_approval' : 'auto_permitted',
        afterValue: { mode, status: run.status },
        isSimulated: true,
      });

      return run;
    },
    [logActivity, state.automations]
  );

  const updateStoreSettings = useCallback(
    (patch: Partial<Store>) => {
      setState((prev) => ({
        ...prev,
        store: { ...prev.store, ...patch },
      }));
      logActivity({
        actor: 'Merchant User',
        actionSummary: 'Updated store configuration settings',
        targetRecords: ['Store Settings'],
        classification: 'reversible_change',
        result: 'simulated',
        approvalDecision: 'approved_by_user',
        afterValue: patch,
        isSimulated: true,
      });
    },
    [logActivity]
  );

  const updateStorePolicy = useCallback(
    (policy: StorePolicy) => {
      setState((prev) => ({
        ...prev,
        store: {
          ...prev.store,
          policies: prev.store.policies.map((p) => (p.id === policy.id ? policy : p)),
        },
      }));
      logActivity({
        actor: 'Merchant User',
        actionSummary: `Updated store policy "${policy.title}"`,
        targetRecords: [policy.title],
        classification: 'reversible_change',
        result: 'simulated',
        approvalDecision: 'approved_by_user',
        isSimulated: true,
      });
    },
    [logActivity]
  );

  const updateApprovalRules = useCallback(
    (rules: ApprovalRuleSet) => {
      setState((prev) => ({
        ...prev,
        store: { ...prev.store, approvalRules: rules },
      }));
      logActivity({
        actor: 'Merchant User',
        actionSummary: 'Updated action approval & narrow auto-approval rules',
        targetRecords: ['Approval Rules'],
        classification: 'reversible_change',
        result: 'simulated',
        approvalDecision: 'approved_by_user',
        afterValue: rules,
        isSimulated: true,
      });
    },
    [logActivity]
  );

  const updateNotifications = useCallback((prefs: NotificationPreferences) => {
    setState((prev) => ({
      ...prev,
      store: { ...prev.store, notifications: prefs },
    }));
  }, []);

  const pendingApprovalsCount = state.approvals.filter((a) => a.decision === 'pending').length;

  return (
    <StoreContext.Provider
      value={{
        state,
        pendingApprovalsCount,
        resetDemoData,
        logActivity,
        queueApproval,
        resolveApproval,
        upsertProduct,
        duplicateProduct,
        archiveProduct,
        importProductsFromCsvRows,
        requestApplyProductTags,
        addOrderNote,
        toggleOrderException,
        requestOrderFulfillmentUpdate,
        requestPrepareShipment,
        markShipmentDeliveredDemo,
        saveConversationDraft,
        requestSendConversationReply,
        updateConversationStatus,
        saveCustomerSegment,
        deleteCustomerSegment,
        adjustInventoryStock,
        saveReturnAnalysis,
        requestReturnDecision,
        attemptBlockedRefund,
        savePromotionDraft,
        requestActivatePromotion,
        saveAutomation,
        toggleAutomationStatus,
        runAutomation,
        updateStoreSettings,
        updateStorePolicy,
        updateApprovalRules,
        updateNotifications,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStoreState(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStoreState must be used within StoreProvider');
  }
  return ctx;
}
