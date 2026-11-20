import { LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { DonorDTO } from "../../../../shared/api";
import { LANGUAGES, LANGUAGE_LABEL } from "../../../../shared/domain";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Dialog } from "../../../components/ui/Dialog";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { ConsentList } from "../ConsentSwitch";
import { PRIVACY_PROMISE } from "../copy";
import { useOptOut, useUpdatePreferences } from "../data";
import { QuietHours } from "./QuietHours";

const WEEKLY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export function SettingsTab({ donor }: { donor: DonorDTO }) {
  const update = useUpdatePreferences(donor.id);
  const optOut = useOptOut(donor.id);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl leading-tight text-ink">Settings</h1>

      <Card className="flex items-center gap-3 p-4">
        <BloodGroupChip group={donor.bloodGroup} variant="label" size="md" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{donor.name}</p>
          <p className="truncate text-sm text-ink-muted">
            {donor.phone} · {donor.areaName}
          </p>
          <p className="text-xs text-ink-faint">
            {donor.donations.length === 0 ? "Blood group self-declared, verified at your first donation" : "Blood group verified"}
          </p>
        </div>
      </Card>

      <Card as="section" aria-labelledby="share-title">
        <CardHeader id="share-title" title="What you share" description="Changes apply immediately." />
        <CardBody className="space-y-3">
          <ConsentList
            values={donor}
            onChange={(key, next) => update.mutate({ [key]: next })}
          />
          <p className="flex gap-2 rounded-(--radius-control) bg-ok-soft p-3 text-sm text-ink">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
            {PRIVACY_PROMISE}
          </p>
        </CardBody>
      </Card>

      <Card as="section" aria-labelledby="reach-pref-title">
        <CardHeader id="reach-pref-title" title="When we can reach you" />
        <CardBody className="space-y-5">
          <QuietHours
            start={donor.quietHoursStart}
            end={donor.quietHoursEnd}
            onChange={(quietHoursStart, quietHoursEnd) => update.mutate({ quietHoursStart, quietHoursEnd })}
          />
          <div className="space-y-2">
            <p className="font-semibold text-ink" id="weekly-label">
              At most {donor.maxAlertsPerWeek} {donor.maxAlertsPerWeek === 1 ? "alert" : "alerts"} a week
            </p>
            <SegmentedControl
              label="Maximum alerts per week"
              value={String(donor.maxAlertsPerWeek)}
              onChange={(v) => update.mutate({ maxAlertsPerWeek: Number(v) })}
              options={WEEKLY_OPTIONS.map((n) => ({ value: String(n), label: n }))}
              className="flex w-full [&_button]:h-11 [&_button]:px-0 [&_button]:text-base"
            />
            <p className="text-sm text-ink-muted">Even in a shortage, we never go past your limit.</p>
          </div>
        </CardBody>
      </Card>

      <Card as="section" aria-labelledby="lang-title">
        <CardHeader id="lang-title" title="Alert language" description="Alerts are translated by an open model; English is always one tap away." />
        <CardBody>
          <SegmentedControl
            label="Alert language"
            value={donor.language}
            onChange={(language) => update.mutate({ language })}
            options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))}
            className="flex w-full [&_button]:h-11 [&_button]:text-base"
          />
        </CardBody>
      </Card>

      <Card as="section" aria-labelledby="optout-title" className="border-critical/30">
        <CardHeader
          id="optout-title"
          title="Opt out of everything"
          description="Stop all alerts and sharing at once. Your donation history stays, and you can come back any time."
        />
        <CardBody>
          <Button variant="danger" size="lg" className="w-full" icon={<LogOut className="size-4" aria-hidden />} onClick={() => setConfirming(true)}>
            Opt out of everything
          </Button>
        </CardBody>
      </Card>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        side="bottom"
        title="Opt out of everything?"
        description="We'll switch off alerts, location and eligibility sharing, and withdraw any alert still waiting for you."
        className="sm:left-1/2 sm:max-w-[420px] sm:-translate-x-1/2"
        footer={
          <>
            <Button size="lg" onClick={() => setConfirming(false)}>
              Keep my settings
            </Button>
            <Button
              variant="danger"
              size="lg"
              loading={optOut.isPending}
              onClick={() => optOut.mutate(true, { onSuccess: () => setConfirming(false) })}
            >
              Opt out
            </Button>
          </>
        }
      />
    </div>
  );
}
