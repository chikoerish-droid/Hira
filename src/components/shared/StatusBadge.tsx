import { AlertTriangle, Ban, CheckCircle2, Clock, FileEdit, ShieldAlert } from 'lucide-react';
import type { ActionOutcomeStatus, StepClassification } from '../../types/domain';

interface StatusTagProps {
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  label: string;
  showIcon?: boolean;
}

export function StatusTag({ tone, label, showIcon = false }: StatusTagProps) {
  const styles: Record<StatusTagProps['tone'], string> = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-red-50 text-red-800 border-red-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'warning'
      ? Clock
      : tone === 'danger'
      ? Ban
      : tone === 'info'
      ? FileEdit
      : AlertTriangle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium border whitespace-nowrap shrink-0 ${styles[tone]}`}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

export function OutcomeTag({ status }: { status: ActionOutcomeStatus }) {
  switch (status) {
    case 'completed':
      return <StatusTag tone="success" label="Completed" showIcon />;
    case 'simulated':
      return <StatusTag tone="info" label="Simulated in demo" showIcon />;
    case 'needs_approval':
      return <StatusTag tone="warning" label="Needs approval" showIcon />;
    case 'blocked':
      return <StatusTag tone="danger" label="Blocked" showIcon />;
    case 'failed':
      return <StatusTag tone="danger" label="Failed" showIcon />;
    case 'cancelled':
      return <StatusTag tone="neutral" label="Cancelled" />;
    case 'skipped':
      return <StatusTag tone="neutral" label="Skipped" />;
  }
}

export function ClassificationTag({ classification }: { classification: StepClassification }) {
  switch (classification) {
    case 'read_only':
      return <StatusTag tone="neutral" label="Read-only" />;
    case 'draft':
      return <StatusTag tone="info" label="Draft" />;
    case 'reversible_change':
      return <StatusTag tone="warning" label="Reversible change" />;
    case 'consequential_external':
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border bg-red-50 text-red-800 border-red-200 whitespace-nowrap shrink-0">
          <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Consequential external</span>
        </span>
      );
  }
}
