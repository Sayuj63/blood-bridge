import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ambulance, ExternalLink, Power, QrCode, RotateCcw, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { SurgeKind } from "../../../shared/domain";
import { Logo } from "../../brand/Logo";
import { Button, LinkButton } from "../../components/ui/Button";
import { ConfirmButton } from "../../components/ui/ConfirmButton";
import { LiveDot } from "../../components/ui/LiveDot";
import { SimulatedBadge } from "../../components/ui/SimulatedBadge";
import { SurgeBanner } from "../../layouts/SurgeBanner";
import { api, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { useForecast, useMeta } from "../../lib/queries";
import { useRealtime } from "../../lib/realtime";
import { JoinQr } from "./JoinQr";
import { MessagingStatus } from "./MessagingStatus";

// Scripted 60-second demo (PRD §7.1): Sion's municipal hospital requests O-negative platelets.
// In the e-RaktKosh snapshot S. L. Raheja (Mahim) holds them, but live syncs can change the top bank,
// so the bank panel follows whichever bank the stage hospital's latest reservation went to.
const STAGE_HOSPITAL = "hsp-sion-ltmgh";
const DEFAULT_BANK = "bb-raheja-mahim";

/** Scenario epicentres, matched by name against /api/meta areas (never hardcoded IDs). */
const SCENARIO_AREA: Record<SurgeKind, string> = { flood: "kurla", mass_casualty: "dadar" };

/** `/stage` — the live 60-second demo: hospital | bank | donor phone, plus a slim control strip. */
export default function StagePage() {
  const qc = useQueryClient();
  const { status } = useRealtime();
  const surge = useForecast().data?.surge ?? null;
  const areas = useMeta().data?.areas ?? [];
  const [showQr, setShowQr] = useState(true);
  const { lastEvent } = useRealtime();
  const [bankId, setBankId] = useState(DEFAULT_BANK);
  useEffect(() => {
    if (!lastEvent?.topics.includes("reservations") || !lastEvent.siteIds?.includes(STAGE_HOSPITAL)) return;
    const bank = lastEvent.siteIds.find((id) => id.startsWith("bb-"));
    if (bank) setBankId(bank);
  }, [lastEvent]);
  const views = [
    { src: `/hospital?embed=1&site=${STAGE_HOSPITAL}`, title: "Hospital view" },
    { src: `/bank?embed=1&site=${bankId}`, title: "Blood bank view" },
  ];

  const reset = useMutation({
    mutationFn: () => api.demo.reset(),
    onSuccess: (r) => {
      toast.success(`Demo reset: ${r.sites} sites, ${r.units} units, ${r.donors} donors`, { duration: 8000 });
      setBankId(DEFAULT_BANK);
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error("Reset failed", { description: errorMessage(e) }),
  });
  const start = useMutation({
    mutationFn: (kind: SurgeKind) =>
      api.surge.start({ kind, areaId: areas.find((a) => a.name.toLowerCase().includes(SCENARIO_AREA[kind]))?.id }),
    onSuccess: (s) => {
      toast.warning(`Surge started: ${s.label} near ${s.areaName}`);
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error("Couldn't start the surge", { description: errorMessage(e) }),
  });
  const end = useMutation({
    mutationFn: () => api.surge.end(),
    onSuccess: () => void qc.invalidateQueries(),
    onError: (e) => toast.error("Couldn't end the surge", { description: errorMessage(e) }),
  });

  return (
    <div data-theme="command" className="flex min-h-dvh flex-col bg-canvas text-ink lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-3 py-2">
        <Link to="/" className="focus-ring rounded-md" aria-label="Blood Bridge home">
          <Logo size={24} />
        </Link>
        <LiveDot status={status} />
        <MessagingStatus />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Demo controls">
          <ConfirmButton
            size="sm"
            loading={reset.isPending}
            icon={<RotateCcw className="size-3.5" aria-hidden />}
            confirmTitle="Reset the demo?"
            confirmDescription="Clears every request, transfer, alert and simulated donor change, and reloads the real bank snapshot."
            confirmLabel="Reset demo"
            onConfirm={() => reset.mutate()}
          >
            Reset demo
          </ConfirmButton>
          {surge ? (
            <ConfirmButton
              size="sm"
              variant="ghost"
              loading={end.isPending}
              icon={<Power className="size-3.5" aria-hidden />}
              confirmTitle="End the surge?"
              confirmDescription="Demand returns to normal and the surge plan is closed. Approved transfers stay in motion."
              confirmLabel="End surge"
              onConfirm={() => end.mutate()}
            >
              End surge
            </ConfirmButton>
          ) : (
            <>
              <Button
                size="sm"
                variant="danger"
                loading={start.isPending && start.variables === "mass_casualty"}
                disabled={start.isPending}
                icon={<Ambulance className="size-3.5" aria-hidden />}
                onClick={() => start.mutate("mass_casualty")}
              >
                Start surge · Mass casualty, Dadar
              </Button>
              <Button
                size="sm"
                loading={start.isPending && start.variables === "flood"}
                disabled={start.isPending}
                icon={<Waves className="size-3.5" aria-hidden />}
                onClick={() => start.mutate("flood")}
              >
                Kurla flood
              </Button>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={showQr}
            icon={<QrCode className="size-3.5" aria-hidden />}
            onClick={() => setShowQr((v) => !v)}
          >
            {showQr ? "Hide QR" : "Show QR"}
          </Button>
          <LinkButton to="/command" target="_blank" size="sm" variant="ghost" icon={<ExternalLink className="size-3.5" aria-hidden />}>
            Command
          </LinkButton>
          <SimulatedBadge compact />
        </div>
      </header>
      {surge ? <SurgeBanner surge={surge} /> : null}

      <main
        className={cn(
          "grid min-h-0 flex-1 gap-3 p-3",
          showQr ? "lg:grid-cols-[1fr_1fr_auto_18rem] 2xl:grid-cols-[1fr_1fr_auto_22rem]" : "lg:grid-cols-[1fr_1fr_auto]",
        )}
      >
        {views.map((v) => (
          <iframe
            key={v.src}
            src={v.src}
            title={v.title}
            className="h-[80dvh] w-full rounded-(--radius-panel) border border-line bg-white lg:h-full"
          />
        ))}
        <PhoneFrame />
        {showQr ? <JoinQr /> : null}
      </main>
    </div>
  );
}

/** Donor view in a phone-shaped frame, sized by available height. */
function PhoneFrame() {
  return (
    <div className="mx-auto flex h-[80dvh] items-center lg:h-full">
      <div className="relative aspect-[390/844] h-full max-h-full rounded-[2.6rem] border-[10px] border-[#1b2a3a] bg-[#1b2a3a] shadow-panel">
        <span aria-hidden className="absolute top-2 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#1b2a3a]" />
        <iframe src="/donor?embed=1" title="Donor phone" className="size-full rounded-[2rem] bg-white" />
      </div>
    </div>
  );
}
