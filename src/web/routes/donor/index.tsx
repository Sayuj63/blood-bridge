import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { DonorDTO, DonorSignupDTO } from "../../../shared/api";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { ApiError, setActor } from "../../lib/api";
import { AlertTakeover } from "./alerts/AlertTakeover";
import { AlertsTab } from "./alerts/AlertsTab";
import { useTakeover } from "./alerts/useTakeover";
import { defaultPersona, useDonor, useDonorAlerts, usePersonas, useRespond } from "./data";
import { DonorFrame, TABS, TabBar, type Tab } from "./DonorFrame";
import "./donor.css";
import { HomeTab } from "./home/HomeTab";
import { Onboarding } from "./onboarding/Onboarding";
import { OptedOut } from "./OptedOut";
import { clearOwnDonorId, readOwnDonorId, saveOwnDonorId } from "./ownDonor";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { SettingsTab } from "./settings/SettingsTab";

/**
 * Donor portal (mobile-first + adaptive desktop). `?donor=<id>` picks the profile;
 * `?join=1` is the stage QR quick join; `?embed=1` locks to single-column mobile mode
 * for the stage phone frame. With neither `donor` nor `join`, a profile created on this
 * device resumes, else the first eligible O− demo persona.
 */
export default function DonorView() {
  const [params, setParams] = useSearchParams();
  const personas = usePersonas();
  const [ownId, setOwnId] = useState(readOwnDonorId);
  const [signingUp, setSigningUp] = useState(false);
  const [justJoined, setJustJoined] = useState(false);
  /** One-time "say hi on WhatsApp" link from a signup that ticked WhatsApp alerts. */
  const [whatsappJoin, setWhatsappJoin] = useState<DonorSignupDTO["whatsappJoin"]>(undefined);
  const quickJoin = params.get("join") === "1";
  const embed = params.get("embed") === "1";
  const requested = params.get("donor");

  /** Update search params in place, keeping the rest (e.g. `embed`). */
  const patchParams = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  // A profile saved on this device that no longer exists (the demo was reset) is forgotten.
  const ownExists = ownId !== null && personas.data?.some((p) => p.id === ownId);
  useEffect(() => {
    if (ownId !== null && personas.data && !ownExists) {
      clearOwnDonorId();
      setOwnId(null);
    }
  }, [ownId, ownExists, personas.data]);

  const onJoined = (donor: DonorSignupDTO, mode: "quick" | "full") => {
    setWhatsappJoin(donor.whatsappJoin?.waLink ? donor.whatsappJoin : undefined);
    if (mode === "quick") {
      saveOwnDonorId(donor.id);
      setOwnId(donor.id);
      setJustJoined(true);
    }
    setSigningUp(false);
    patchParams({ donor: donor.id, join: null, tab: "home" });
    window.scrollTo({ top: 0 });
  };

  if (quickJoin || signingUp) {
    const mode = quickJoin ? "quick" : "full";
    return (
      <DonorFrame top={null} embed={embed}>
        <Onboarding mode={mode} onDone={(d) => onJoined(d, mode)} onCancel={quickJoin ? undefined : () => setSigningUp(false)} />
      </DonorFrame>
    );
  }

  if (personas.isError) {
    return (
      <DonorFrame top={null} embed={embed}>
        <ErrorState what="donor profiles" error={personas.error} onRetry={() => void personas.refetch()} />
      </DonorFrame>
    );
  }

  const donorId = requested ?? (ownExists ? ownId : null) ?? (personas.data ? defaultPersona(personas.data)?.id : undefined);

  if (personas.isPending || donorId === undefined) {
    return personas.isPending ? (
      <LoadingFrame embed={embed} />
    ) : (
      <DonorFrame top={null} embed={embed}>
        <div className="d-card-blush mx-auto my-auto flex max-w-sm flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="d-display text-lg font-bold text-[#171717]">No donor profiles yet</p>
          <p className="text-sm text-[#737373]">Join Mumbai&apos;s voluntary donor network in under a minute.</p>
          <Button variant="primary" size="lg" className="w-full rounded-xl bg-[#C93245] hover:bg-[#A82436]" onClick={() => setSigningUp(true)}>
            Become a donor
          </Button>
        </div>
      </DonorFrame>
    );
  }

  return (
    <DonorApp
      key={donorId}
      donorId={donorId}
      personas={personas.data}
      embed={embed}
      // A judge's phone shows only their own profile, without the demo switcher.
      showSwitcher={donorId !== ownId}
      justJoined={justJoined}
      whatsappJoin={whatsappJoin}
      tab={TABS.find((t) => t === params.get("tab")) ?? "home"}
      onTab={(t) => {
        patchParams({ tab: t });
        window.scrollTo({ top: 0 });
      }}
      onSelect={(id) => patchParams({ donor: id, tab: null })}
      onResetDonor={() => patchParams({ donor: null })}
      onSignUp={() => setSigningUp(true)}
    />
  );
}

function LoadingFrame({ embed }: { embed: boolean }) {
  return (
    <DonorFrame top={<Skeleton className="ml-auto h-9 w-44 rounded-full" />} embed={embed}>
      <div className="space-y-4" aria-busy="true" aria-label="Loading your donor profile">
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </DonorFrame>
  );
}

interface DonorAppProps {
  donorId: string;
  personas: DonorDTO[];
  embed: boolean;
  showSwitcher: boolean;
  justJoined: boolean;
  whatsappJoin: DonorSignupDTO["whatsappJoin"];
  tab: Tab;
  onTab: (tab: Tab) => void;
  onSelect: (donorId: string) => void;
  onResetDonor: () => void;
  onSignUp: () => void;
}

function DonorApp({
  donorId,
  personas,
  embed,
  showSwitcher,
  justJoined,
  whatsappJoin,
  tab,
  onTab,
  onSelect,
  onResetDonor,
  onSignUp,
}: DonorAppProps) {
  const donor = useDonor(donorId);
  const alerts = useDonorAlerts(donorId);
  const respond = useRespond(donorId);
  const takeover = useTakeover(alerts.data);

  useEffect(() => {
    setActor(`donor:${donorId}`);
  }, [donorId]);

  const switcher = showSwitcher ? (
    <PersonaSwitcher personas={personas} current={donor.data} onSelect={onSelect} onJoin={onSignUp} />
  ) : null;

  if (donor.isPending) return <LoadingFrame embed={embed} />;

  if (donor.isError) {
    const missing = donor.error instanceof ApiError && donor.error.status === 404;
    return (
      <DonorFrame top={switcher} embed={embed}>
        <ErrorState what="this donor profile" error={donor.error} onRetry={() => void donor.refetch()} />
        {missing ? (
          <Button variant="secondary" size="lg" className="mx-auto mt-3" onClick={onResetDonor}>
            Use a demo persona
          </Button>
        ) : null}
      </DonorFrame>
    );
  }

  const d = donor.data;

  if (d.optedOutAt !== null) {
    return (
      <DonorFrame top={switcher} embed={embed}>
        <OptedOut donor={d} onOptedIn={() => onTab("settings")} />
      </DonorFrame>
    );
  }

  const pending = alerts.data?.filter((a) => a.status === "sent") ?? [];
  const announce = pending[0];

  return (
    <>
      <DonorFrame
        top={switcher}
        embed={embed}
        inert={takeover.current !== null}
        sidebar={{
          donor: d,
          tab,
          onTab,
          alertCount: pending.length,
          onSignUp,
        }}
        footer={<TabBar tab={tab} onChange={onTab} alertCount={pending.length} />}
      >
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          {tab === "home" ? (
            <HomeTab donor={d} pending={pending[0]} justJoined={justJoined} whatsappJoin={whatsappJoin} onOpenAlert={takeover.open} />
          ) : tab === "alerts" ? (
            <AlertsTab
              donor={d}
              alerts={alerts.data}
              isError={alerts.isError}
              error={alerts.error}
              onRetry={() => void alerts.refetch()}
              onOpen={takeover.open}
            />
          ) : (
            <SettingsTab donor={d} />
          )}
        </motion.div>
      </DonorFrame>

      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {announce ? `New alert: ${announce.bloodGroup} donors needed at ${announce.bankName}, ${announce.distanceKm.toFixed(1)} km away.` : ""}
      </div>

      <AlertTakeover
        alert={takeover.current}
        donor={d}
        responding={respond.isPending}
        onRespond={(alertId, response) => respond.mutate({ alertId, response })}
        onClose={takeover.close}
      />
    </>
  );
}
