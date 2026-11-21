import { useQuery } from "@tanstack/react-query";
import { PlugZap, RefreshCw } from "lucide-react";
import type { IntegrationDTO } from "../../../../shared/api";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../shared/useAction";

const STATE: Record<IntegrationDTO["state"], { label: string; tone: "ok" | "info" | "warn" | "neutral" | "critical" }> = {
  available: { label: "Live", tone: "ok" },
  connected: { label: "Connected", tone: "ok" },
  not_configured: { label: "Ready · needs key", tone: "info" },
  other_site: { label: "Other bank", tone: "neutral" },
  partner_required: { label: "Partner access", tone: "neutral" },
  error: { label: "Last sync failed", tone: "warn" },
};

/** The stock systems this bank can feed Blood Bridge from: public portal and blood-bank software. */
export function ConnectedSystems({ siteId }: { siteId: string }) {
  // Under the "stock" root so every stock change (and realtime event) refreshes it.
  const query = useQuery({ queryKey: ["stock", siteId, "integrations"], queryFn: ({ signal }) => api.sites.integrations(siteId, signal) });
  const eraktkosh = useAction({
    run: () => api.sites.syncEraktkosh(siteId),
    success: (r) => `e-RaktKosh: +${r.added} / −${r.removed} units`,
  });
  const rakt = useAction({ run: () => api.sites.syncRakt(siteId), success: (r) => `RAKT: ${r.inStock} in stock (+${r.added} / −${r.removed})` });
  const sync: Partial<Record<IntegrationDTO["id"], typeof rakt | typeof eraktkosh>> = { eraktkosh, rakt };

  return (
    <section aria-labelledby="systems-title" className="rounded-(--radius-panel) border border-line bg-surface">
      <h3 id="systems-title" className="flex items-center gap-2 border-b border-line px-4 py-2.5 font-semibold">
        <PlugZap className="size-4 text-ink-muted" aria-hidden />
        Connected systems
      </h3>
      <ul className="divide-y divide-line">
        {(query.data ?? []).map((s) => {
          const action = sync[s.id];
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {s.name}
                  <Badge tone={STATE[s.state].tone} size="sm">
                    {STATE[s.state].label}
                  </Badge>
                </p>
                <p className="truncate text-xs text-ink-muted" title={s.detail ?? s.description}>
                  {s.detail ?? s.description}
                </p>
              </div>
              {s.canSync && action ? (
                <Button size="sm" icon={<RefreshCw className="size-3.5" aria-hidden />} loading={action.isPending} onClick={() => action.mutate(undefined)}>
                  Sync
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
