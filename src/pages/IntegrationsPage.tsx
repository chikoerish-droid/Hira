import { useState } from 'react';
import { Lock, Plug, ShieldCheck, X } from 'lucide-react';
import { CONNECTOR_CATALOG } from '../connectors/platformCatalog';
import type { Connection } from '../types/domain';
import { StatusTag } from '../components/shared/StatusBadge';

export function IntegrationsPage() {
  const [selected, setSelected] = useState<Connection | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Integrations &amp; Connector Boundary</h1>
        <p className="mt-1 text-sm text-slate-600">
          Platform-neutral connector architecture. All external storefront connectors remain disconnected in this demo; no store credentials or tokens are requested.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 flex items-start gap-2.5">
        <Lock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Security &amp; Honesty Boundary</p>
          <p>
            This workspace is running on the <strong>Local Demo Store Sandbox (DEMO STORE — NOT CONNECTED)</strong>. Do not enter real API keys or passwords here. Production integrations use server-side OAuth or scoped API credentials and respect platform rate limits, CAPTCHA, and terms of service.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONNECTOR_CATALOG.map((conn) => (
          <div key={conn.id} className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Plug className="h-4 w-4 text-slate-600 shrink-0" />
                  <h2 className="text-sm font-semibold text-slate-900">{conn.displayName}</h2>
                </div>
                <StatusTag
                  tone={conn.status === 'demo_active' ? 'info' : 'neutral'}
                  label={conn.status === 'demo_active' ? 'DEMO SANDBOX ACTIVE' : 'DISCONNECTED'}
                />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{conn.description}</p>
              <p className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Data categories:</span> {conn.dataCategories.join(' · ')}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[11px] font-mono text-slate-500">
                Type: {conn.connectionType.replace('_', ' ')}
              </span>
              <button
                type="button"
                onClick={() => setSelected(conn)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Inspect Scopes &amp; Capabilities
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Connector Specification Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">{selected.displayName}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Connection Status</span>
                <StatusTag
                  tone={selected.status === 'demo_active' ? 'info' : 'neutral'}
                  label={selected.status === 'demo_active' ? 'DEMO SANDBOX ACTIVE' : 'DISCONNECTED'}
                />
              </div>

              <div>
                <p className="font-semibold text-slate-900 mb-1">Required Permission Scopes</p>
                <div className="rounded border border-slate-200 bg-slate-50 p-3 font-mono text-slate-700 space-y-1">
                  {selected.requiredScopes.map((scope) => (
                    <div key={scope}>{scope}</div>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-900 mb-1">Connector Interface Capabilities</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selected.capabilities).map(([cap, allowed]) => (
                    <div key={cap} className="flex items-center justify-between rounded border border-slate-200 px-3 py-1.5">
                      <span className="text-slate-700">{cap}</span>
                      <span className={allowed ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                        {allowed ? 'Supported' : 'Blocked'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-slate-700 leading-relaxed">
                <span className="font-semibold text-slate-900">Compliance &amp; Security Note: </span>
                {selected.complianceNote}
              </div>

              {selected.status === 'disconnected' && (
                <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
                  Live OAuth connection is disabled in this standalone demo build. No secrets or access tokens are accepted here.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
