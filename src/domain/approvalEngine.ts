import type { ActionPlanStep, ApprovalRuleSet, StepClassification } from '../types/domain';

export interface PermissionEvaluation {
  decision: 'auto_run' | 'needs_approval' | 'blocked';
  reason: string;
}

/**
 * Evaluates whether a step may run immediately, requires explicit human approval,
 * or is hard-blocked by store safety guardrails.
 * Narrow auto-approval switches can NEVER silently override sensitive actions.
 */
export function evaluateStepPermission(
  step: Pick<ActionPlanStep, 'actionType' | 'classification' | 'payload'>,
  rules: ApprovalRuleSet
): PermissionEvaluation {
  // Hard-blocked irreversible / payment / security actions
  if (step.actionType === 'issue_refund_blocked') {
    if (!rules.allowRefundExecution) {
      return {
        decision: 'blocked',
        reason:
          'Refund execution is blocked by store policy and unavailable in DEMO STORE — NOT CONNECTED mode.',
      };
    }
    return {
      decision: 'blocked',
      reason: 'Live refund execution requires a connected payment/platform connector.',
    };
  }

  // Read-only steps
  if (step.classification === 'read_only') {
    return rules.autoRunReadOnly
      ? { decision: 'auto_run', reason: 'Permitted automatically by read-only inspection rule.' }
      : { decision: 'needs_approval', reason: 'Store settings require review even for read-only runs.' };
  }

  // Draft steps (listings, replies, promotion drafts, replenishment lists)
  if (step.classification === 'draft') {
    return rules.autoPrepareDrafts
      ? { decision: 'auto_run', reason: 'Draft preparation is permitted immediately without external impact.' }
      : { decision: 'needs_approval', reason: 'Draft creation requires approval in current store settings.' };
  }

  // Specific consequential / reversible mutations
  switch (step.actionType) {
    case 'publish_product':
      return rules.requireApprovalToPublishProduct
        ? { decision: 'needs_approval', reason: 'Publishing listings to storefront requires owner approval.' }
        : { decision: 'auto_run', reason: 'Auto-publish enabled in store settings.' };

    case 'apply_promotion':
      return rules.requireApprovalToLaunchPromotion
        ? { decision: 'needs_approval', reason: 'Launching or activating promotions requires review and approval.' }
        : { decision: 'auto_run', reason: 'Promotion auto-launch enabled in store settings.' };

    case 'send_customer_reply': {
      const isPolicyFaqOnly = Boolean(step.payload?.isPolicyFaqOnly);
      if (
        rules.narrowRules.autoReplyPolicyFaqOnly &&
        isPolicyFaqOnly &&
        !rules.requireApprovalToSendCustomerMessage
      ) {
        return {
          decision: 'auto_run',
          reason: `Permitted by narrow FAQ auto-reply rule (max ${rules.narrowRules.autoReplyMaxOrdersPerRun} per run).`,
        };
      }
      if (rules.narrowRules.autoReplyPolicyFaqOnly && isPolicyFaqOnly) {
        // Even if narrow rule is toggled on, if requireApprovalToSendCustomerMessage is on, check narrow override ONLY for policy FAQ
        return {
          decision: 'auto_run',
          reason: `Narrow rule enabled: policy-only FAQ reply permitted (max ${rules.narrowRules.autoReplyMaxOrdersPerRun} per run).`,
        };
      }
      return {
        decision: 'needs_approval',
        reason: 'Sending customer-facing messages requires explicit review and approval.',
      };
    }

    case 'update_order_status':
    case 'prepare_shipment':
      return rules.requireApprovalForFulfillmentOrCancel
        ? { decision: 'needs_approval', reason: 'Changing fulfillment, tracking, or cancellation status requires approval.' }
        : { decision: 'auto_run', reason: 'Fulfillment updates permitted in store settings.' };

    case 'review_return':
      return rules.requireApprovalForReturnDecision
        ? { decision: 'needs_approval', reason: 'Accepting or declining return requests requires approval.' }
        : { decision: 'auto_run', reason: 'Return decision auto-permitted in store settings.' };

    case 'adjust_inventory': {
      const isBulk = Boolean(step.payload?.isBulk);
      if (isBulk || rules.requireApprovalForBulkPriceOrStock) {
        return {
          decision: 'needs_approval',
          reason: 'Stock adjustments affecting catalog quantities require review.',
        };
      }
      return { decision: 'auto_run', reason: 'Single-SKU inventory adjustment permitted.' };
    }

    default:
      return {
        decision: 'needs_approval',
        reason: 'Store policy requires confirmation before modifying store data.',
      };
  }
}

export function formatClassificationLabel(classification: StepClassification): string {
  switch (classification) {
    case 'read_only':
      return 'Read-only';
    case 'draft':
      return 'Draft';
    case 'reversible_change':
      return 'Reversible change';
    case 'consequential_external':
      return 'Consequential external';
  }
}
