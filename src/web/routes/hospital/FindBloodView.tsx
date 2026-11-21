import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Grid3x3, MapPin, Phone, Search, Siren, Sparkles, Timer } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { CreateRequestInput, SearchInput, SiteDTO } from "../../../shared/api";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABEL, URGENCIES, type Urgency } from "../../../shared/domain";
import { etaMinutes, haversineKm } from "../../../shared/geo";
import type { RankedOption } from "../../../shared/ranking";
import { planSplit } from "../../../shared/split";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/EmptyState";
import { ExpiryBadge } from "../../components/ui/ExpiryBadge";
import { FreshnessPill } from "../../components/ui/FreshnessPill";
import { Skeleton } from "../../components/ui/Skeleton";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatIST, plural, spokenGroup } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { AllocationChips } from "./AllocationChips";
import { HospitalMap } from "./HospitalMap";
import { NoMatchState } from "./NoMatchState";
import { RankWhy } from "./RankWhy";
import { SplitPlanCard } from "./SplitPlanCard";
import { UnitsStepper } from "./UnitsStepper";
import { NEEDED_BY_FOR_URGENCY, NEEDED_BY_OPTIONS, WARDS, toCreateInput, toSearchInput, type RequestFormValues } from "./formModel";
import { useHospitalMutations } from "./useHospitalMutations";

const URGENCY_LABEL: Record<Urgency, string> = { routine: "Routine", urgent: "Urgent", critical: "Critical" };

export interface FindBloodViewProps {
  hospital: SiteDTO;
  sites: SiteDTO[];
  formValues: RequestFormValues;
  onFormChange: (values: RequestFormValues) => void;
  autoSearchToken: number;
  onOpenRequest: (requestId: string) => void;
  onOpenCompatibility: () => void;
}

export function FindBloodView({
  hospital,
  sites,
  formValues,
  onFormChange,
  autoSearchToken,
  onOpenRequest,
  onOpenCompatibility,
}: FindBloodViewProps) {
  const id = useId();
  const [submitted, setSubmitted] = useState<CreateRequestInput | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [wardError, setWardError] = useState<string | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const bgRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const compRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const urgRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveRadio = <T extends string>(
    e: KeyboardEvent<HTMLDivElement>,
    items: readonly T[],
    current: T,
    cols: number,
    refs: React.MutableRefObject<(HTMLButtonElement | null)[]>,
    onPick: (next: T) => void,
  ) => {
    let idx: number | null = null;
    const i = items.indexOf(current);
    if (e.key === "Home") idx = 0;
    else if (e.key === "End") idx = items.length - 1;
    else {
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (step !== undefined) idx = (i + step + items.length) % items.length;
    }
    if (idx === null) return;
    e.preventDefault();
    onPick(items[idx]);
    refs.current[idx]?.focus();
  };

  const { createAndReserve, reserveSplit, critical } = useHospitalMutations(hospital.id, { openRequest: onOpenRequest });

  useEffect(() => {
    if (autoSearchToken > 0) {
      setSubmitted(toCreateInput(formValues, hospital.id, Date.now()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearchToken, hospital.id]);

  const search: SearchInput | null = useMemo(() => (submitted ? toSearchInput(submitted) : null), [submitted]);

  const query = useQuery({
    queryKey: search ? queryKeys.search(search) : ["search", "idle"],
    queryFn: () => api.search(search!),
    enabled: search !== null,
    placeholderData: (prev) => prev,
  });

  const searchKey = search ? JSON.stringify(search) : "";
  useEffect(() => {
    if (searchKey) resultsHeadingRef.current?.focus();
  }, [searchKey]);

  const banks = useMemo(() => sites.filter((s) => s.kind === "blood_bank"), [sites]);
  const nearestBanks = useMemo(() => {
    const list = banks
      .map((b) => ({
        site: b,
        km: Math.round(haversineKm(hospital, b) * 10) / 10,
        eta: etaMinutes(hospital, b),
      }))
      .sort((a, b) => a.eta - b.eta)
      .slice(0, 6);
    const maxAvail = Math.max(...list.map((x) => x.site.totalAvailable), 1);
    return list.map((x) => ({ ...x, barPct: Math.max(8, Math.round((x.site.totalAvailable / maxAvail) * 100)) }));
  }, [banks, hospital]);

  const options = useMemo(() => query.data?.options ?? [], [query.data]);
  const split = useMemo(
    () => (search && options.length > 0 && !options[0].coversRequest ? planSplit(options, search.unitsNeeded, search.bloodGroup) : null),
    [options, search],
  );

  const reservingSiteId = createAndReserve.isPending ? createAndReserve.variables.bankSiteId : null;

  const setField = <K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) => {
    if (key === "ward") setWardError(null);
    onFormChange({ ...formValues, [key]: value });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formValues.ward.trim()) {
      setWardError("Enter a ward or department.");
      return;
    }
    setWardError(null);
    setSubmitted(toCreateInput(formValues, hospital.id, Date.now()));
  };

  const focusCard = (siteId: string) => {
    const el = document.getElementById(`result-${siteId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el?.focus({ preventScroll: true });
  };

  return (
    <div className="space-y-5">
      {/* Tactile Blush-Tinted Search Desk */}
      <section aria-labelledby={`${id}-form-title`} className="h-card-blush p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${id}-form-title`} className="h-display text-base font-bold text-[#171717]">
            Find compatible blood
          </h2>
          <Button size="sm" variant="secondary" onClick={onOpenCompatibility} icon={<Grid3x3 className="size-3.5" aria-hidden />}>
            Compatibility matrix
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Blood Group Selector */}
            <div className="lg:col-span-5">
              <span id={`${id}-bg`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#737373]">
                Blood group
              </span>
              <div
                role="radiogroup"
                aria-labelledby={`${id}-bg`}
                onKeyDown={(e) => moveRadio(e, BLOOD_GROUPS, formValues.bloodGroup, 4, bgRefs, (g) => setField("bloodGroup", g))}
                className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 lg:grid-cols-4"
              >
                {BLOOD_GROUPS.map((g, idx) => {
                  const selected = formValues.bloodGroup === g;
                  return (
                    <button
                      key={g}
                      ref={(el) => {
                        bgRefs.current[idx] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={spokenGroup(g)}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setField("bloodGroup", g)}
                      className={cn(
                        "focus-ring h-num relative flex h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border text-sm font-extrabold transition-all",
                        selected
                          ? "border-[#C93245] bg-[#C93245] text-white shadow-sm ring-2 ring-[#C93245]/25"
                          : "border-[#EAE6E3] bg-white text-[#171717] hover:border-[#C93245]/45 hover:bg-[#FCEBED]/50",
                      )}
                    >
                      {selected ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
                      <span>{g.replace("-", "−")}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Component & Urgency */}
            <div className="space-y-3 lg:col-span-4">
              <div>
                <span id={`${id}-comp`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#737373]">
                  Component
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby={`${id}-comp`}
                  onKeyDown={(e) => moveRadio(e, COMPONENTS, formValues.component, 2, compRefs, (c) => setField("component", c))}
                  className="grid grid-cols-2 gap-1.5"
                >
                  {COMPONENTS.map((c, idx) => {
                    const selected = formValues.component === c;
                    return (
                      <button
                        key={c}
                        ref={(el) => {
                          compRefs.current[idx] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setField("component", c)}
                        className={cn(
                          "focus-ring inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold transition-all",
                          selected
                            ? "border-[#171717] bg-[#171717] text-white shadow-xs"
                            : "border-[#EAE6E3] bg-white text-[#171717] hover:border-[#C93245]/40 hover:bg-[#FCEBED]/40",
                        )}
                      >
                        {selected ? <Check className="size-3 shrink-0" aria-hidden /> : null}
                        <span className="truncate">{COMPONENT_LABEL[c]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span id={`${id}-urg`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#737373]">
                  Urgency
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby={`${id}-urg`}
                  onKeyDown={(e) =>
                    moveRadio(e, URGENCIES, formValues.urgency, 3, urgRefs, (u) =>
                      onFormChange({ ...formValues, urgency: u, neededInMinutes: NEEDED_BY_FOR_URGENCY[u] }),
                    )
                  }
                  className="grid grid-cols-3 gap-1.5"
                >
                  {URGENCIES.map((u, idx) => {
                    const selected = formValues.urgency === u;
                    return (
                      <button
                        key={u}
                        ref={(el) => {
                          urgRefs.current[idx] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onFormChange({ ...formValues, urgency: u, neededInMinutes: NEEDED_BY_FOR_URGENCY[u] })}
                        className={cn(
                          "focus-ring inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-xl border text-xs font-bold transition-all",
                          selected && u === "critical"
                            ? "border-[#A82436] bg-[#A82436] text-white shadow-xs"
                            : selected
                              ? "border-[#C93245] bg-[#FCEBED] text-[#A82436]"
                              : "border-[#EAE6E3] bg-white text-[#737373] hover:border-[#C93245]/35 hover:text-[#171717]",
                        )}
                      >
                        {selected ? <Check className="size-3 shrink-0" aria-hidden /> : null}
                        <span>{URGENCY_LABEL[u]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Units, Needed By, Ward */}
            <div className="space-y-3 lg:col-span-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor={`${id}-units`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#737373]">
                    Units
                  </label>
                  <UnitsStepper id={`${id}-units`} value={formValues.unitsNeeded} onChange={(n) => setField("unitsNeeded", n)} />
                </div>
                <div>
                  <label htmlFor={`${id}-needed`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#737373]">
                    Needed by
                  </label>
                  <select
                    id={`${id}-needed`}
                    value={formValues.neededInMinutes}
                    onChange={(e) => setField("neededInMinutes", Number(e.target.value))}
                    className="focus-ring h-11 w-full rounded-xl border border-[#EAE6E3] bg-white px-2.5 text-xs font-semibold text-[#171717]"
                  >
                    {NEEDED_BY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor={`${id}-ward`} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#737373]">
                  Ward
                </label>
                <input
                  id={`${id}-ward`}
                  list={`${id}-wards`}
                  value={formValues.ward}
                  maxLength={60}
                  onChange={(e) => setField("ward", e.target.value)}
                  aria-invalid={wardError !== null}
                  aria-describedby={wardError ? `${id}-ward-err` : undefined}
                  className={cn(
                    "focus-ring h-9 w-full rounded-xl border bg-white px-3 text-xs font-semibold text-[#171717]",
                    wardError ? "border-[#C93245]" : "border-[#EAE6E3]",
                  )}
                  autoComplete="off"
                />
                <datalist id={`${id}-wards`}>
                  {WARDS.map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
                {wardError ? (
                  <p id={`${id}-ward-err`} role="alert" className="mt-1 text-[11px] font-semibold text-[#C93245]">
                    {wardError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EAE6E3] pt-3.5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#171717] ring-1 ring-[#EAE6E3]">
              <span className="h-num rounded bg-[#FCEBED] px-1.5 py-0.5 font-extrabold text-[#A82436]">{formValues.bloodGroup}</span>
              {plural(formValues.unitsNeeded, "unit")} {COMPONENT_LABEL[formValues.component]} · {formValues.ward || "Ward"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {formValues.urgency === "critical" ? (
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  loading={critical.isPending}
                  icon={<Siren className="size-4" aria-hidden />}
                  onClick={() => critical.mutate({ input: toCreateInput(formValues, hospital.id, Date.now()) })}
                >
                  Critical alert
                </Button>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={<Search className="size-4" aria-hidden />}
                className="h-primary-cta group rounded-xl px-5 font-bold"
              >
                <span>Find compatible blood</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Button>
            </div>
          </div>
        </form>
      </section>

      {/* Split Results: Map (Left) + Visual Ranked Cards (Right) */}
      {!submitted || !search ? (
        <section aria-label="Mumbai blood bank network" className="grid gap-4 lg:grid-cols-12">
          <div className="h-card overflow-hidden lg:col-span-7">
            <div className="flex items-center justify-between border-b border-[#EAE6E3] bg-[#FFF5F5]/60 px-4 py-3">
              <span className="h-display inline-flex items-center gap-2 text-sm font-bold text-[#171717]">
                <MapPin className="size-4 text-[#C93245]" aria-hidden />
                {banks.length} connected banks
              </span>
              <span className="text-xs font-medium text-[#737373]">Origin: {hospital.shortName}</span>
            </div>
            <div className="h-80 lg:h-[26rem]">
              <HospitalMap
                hospital={hospital}
                banks={banks.map((b) => ({ siteId: b.id, label: `${b.name}: ${b.totalAvailable} units`, stale: b.stale }))}
                focusId={hovered}
                label={`Blood banks around ${hospital.name}`}
                className="size-full"
              />
            </div>
          </div>

          <div className="h-card flex flex-col justify-between p-4 lg:col-span-5">
            <div>
              <h3 className="h-display text-sm font-bold text-[#171717]">Nearest banks · live stock</h3>
              <ul className="mt-3 space-y-2">
                {nearestBanks.map(({ site, km, eta, barPct }) => (
                  <li key={site.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHovered(site.id)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(site.id)}
                      onBlur={() => setHovered(null)}
                      onClick={() => setSubmitted(toCreateInput(formValues, hospital.id, Date.now()))}
                      aria-label={`${site.name}: ${site.totalAvailable} units available, ${km} km away, ~${eta} min ETA. Click to rank compatible stock.`}
                      className={cn(
                        "focus-ring group w-full cursor-pointer rounded-xl border p-2.5 text-left transition-all",
                        hovered === site.id ? "border-[#F2D7DB] bg-[#FFF5F5]" : "border-transparent bg-[#FAF9F6] hover:border-[#F2D7DB] hover:bg-[#FFF5F5]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-bold text-[#171717] group-hover:text-[#A82436]">{site.shortName}</span>
                        <span className="h-num font-extrabold text-[#C93245]">{site.totalAvailable}u</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EAE6E3]">
                          <div className="h-full rounded-full bg-[#C93245]" style={{ width: `${barPct}%` }} />
                        </div>
                        <span className="h-num text-[11px] text-[#737373]">
                          {km}km · {eta}m
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              variant="primary"
              size="md"
              className="h-primary-cta group mt-4 w-full rounded-xl font-bold"
              onClick={() => setSubmitted(toCreateInput(formValues, hospital.id, Date.now()))}
              icon={<Search className="size-4" aria-hidden />}
            >
              <span>Rank {formValues.bloodGroup.replace("-", "−")} {COMPONENT_LABEL[formValues.component]}</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Button>
          </div>
        </section>
      ) : (
        <section aria-labelledby="find-results-heading" aria-busy={query.isFetching} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3
              id="find-results-heading"
              ref={resultsHeadingRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className="h-display text-sm font-bold text-[#171717] outline-none"
            >
              {plural(options.length, "bank")} matched · {plural(search.unitsNeeded, "unit")} {search.bloodGroup.replace("-", "−")}{" "}
              {COMPONENT_LABEL[search.component]}
            </h3>
            {query.data ? <span className="h-num text-xs text-[#737373]">{formatIST(query.data.searchedAt, true)}</span> : null}
          </div>

          {query.isError ? (
            <ErrorState what="search results" error={query.error} onRetry={() => void query.refetch()} />
          ) : query.data?.noMatch ? (
            <NoMatchState
              search={search}
              noMatch={query.data.noMatch}
              onCritical={() => critical.mutate({ input: { ...submitted, urgency: "critical" } })}
              criticalPending={critical.isPending}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="h-card h-72 overflow-hidden lg:sticky lg:top-20 lg:col-span-6 lg:h-[min(38rem,calc(100dvh-8rem))]">
                <HospitalMap
                  hospital={hospital}
                  banks={options.map((o) => ({ siteId: o.siteId, rank: o.rank, label: `#${o.rank} ${o.name}`, stale: o.stale }))}
                  focusId={hovered ?? options[0]?.siteId}
                  onBankClick={focusCard}
                  label={`Ranked blood banks around ${hospital.name}`}
                  className="size-full"
                />
              </div>

              <div className="space-y-3 lg:col-span-6">
                {split ? (
                  <SplitPlanCard
                    plan={split}
                    unitsNeeded={search.unitsNeeded}
                    onReserveAll={() => reserveSplit.mutate({ input: submitted }, { onSuccess: () => setSubmitted(null) })}
                    pending={reserveSplit.isPending}
                    disabled={reservingSiteId !== null}
                    onCritical={() => critical.mutate({ input: { ...submitted, urgency: "critical" } })}
                    criticalPending={critical.isPending}
                  />
                ) : null}

                <ol className="space-y-3">
                  {query.isPending
                    ? Array.from({ length: 3 }, (_, i) => (
                        <li key={i}>
                          <Skeleton className="h-44 rounded-2xl" />
                        </li>
                      ))
                    : options.map((option) => (
                        <li key={option.siteId}>
                          <BloodBankResultCard
                            option={option}
                            unitsNeeded={search.unitsNeeded}
                            highlighted={hovered === option.siteId}
                            reserving={reservingSiteId === option.siteId}
                            disabled={reservingSiteId !== null && reservingSiteId !== option.siteId}
                            onReserve={() =>
                              createAndReserve.mutate(
                                { input: submitted, bankSiteId: option.siteId },
                                { onSuccess: () => setSubmitted(null) },
                              )
                            }
                            onHover={setHovered}
                          />
                        </li>
                      ))}
                </ol>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function BloodBankResultCard({
  option,
  unitsNeeded,
  highlighted,
  reserving,
  disabled,
  onReserve,
  onHover,
}: {
  option: RankedOption;
  unitsNeeded: number;
  highlighted: boolean;
  reserving: boolean;
  disabled: boolean;
  onReserve: () => void;
  onHover: (siteId: string | null) => void;
}) {
  const soonest = Math.min(...option.allocation.map((u) => u.expiresAt));
  const exact = option.matchType === "exact";
  const best = option.rank === 1;

  return (
    <article
      id={`result-${option.siteId}`}
      tabIndex={-1}
      aria-labelledby={`result-${option.siteId}-name`}
      onMouseEnter={() => onHover(option.siteId)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(option.siteId)}
      className={cn(
        "h-card-interactive focus-ring p-4",
        best ? "h-card-blush border-[#C93245]/50" : "h-card",
        highlighted && "border-[#C93245]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "h-num grid size-9 shrink-0 place-items-center rounded-xl text-sm font-extrabold",
            best ? "bg-[#C93245] text-white" : "bg-[#FCEBED] text-[#A82436]",
          )}
        >
          #{option.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id={`result-${option.siteId}-name`} className="h-display text-sm font-bold text-[#171717]">
              {option.name}
            </h4>
            {best ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#C93245] px-2 py-0.5 text-[10px] font-bold text-white">
                <Sparkles className="size-2.5" aria-hidden />
                Recommended
              </span>
            ) : null}
          </div>
          <p className="h-num mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#737373]">
            <span>{option.distanceKm} km</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 font-bold text-[#171717]">
              <Timer className="size-3 text-[#C93245]" aria-hidden />~{option.etaMinutes} min
            </span>
            <RankWhy option={option} unitsNeeded={unitsNeeded} />
          </p>
        </div>
        <Button
          variant={best ? "primary" : "secondary"}
          size="sm"
          loading={reserving}
          disabled={disabled}
          onClick={onReserve}
          aria-label={`Reserve ${option.allocation.length} ${plural(option.allocation.length, "unit")} from ${option.name}`}
          className={cn("group hidden rounded-xl sm:inline-flex", best && "h-primary-cta px-3.5 font-bold")}
        >
          <span>{best ? "Reserve now" : "Reserve"}</span>
          {best ? <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /> : null}
        </Button>
      </div>

      <div className="mt-3 space-y-2.5 sm:pl-12">
        <AllocationChips units={option.allocation} />

        <div className="flex flex-wrap items-center gap-1.5">
          <ExpiryBadge expiresAt={soonest} size="sm" />
          <FreshnessPill minutes={option.freshnessMinutes} stale={option.stale} />
          {!option.coversRequest ? (
            <span className="rounded-md bg-[#FCEBED] px-2 py-0.5 text-[11px] font-bold text-[#C93245]">
              {option.allocation.length}/{unitsNeeded} units
            </span>
          ) : null}
        </div>

        {exact ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
            Exact match
          </p>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FEFCE8] px-3 py-2 text-xs text-[#A16207]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Compatible alternative ({option.alternativeGroups.join(", ")}) — <strong>clinician must confirm</strong>.
            </span>
          </div>
        )}

        {option.stale ? (
          <div className="flex items-start gap-2 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-3 py-2 text-xs text-[#C2410C]">
            <Phone className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>Stale stock data · phone check needed before pickup.</span>
          </div>
        ) : null}

        <Button
          variant={best ? "primary" : "secondary"}
          size="md"
          loading={reserving}
          disabled={disabled}
          onClick={onReserve}
          className="w-full rounded-xl sm:hidden"
        >
          Reserve
        </Button>
      </div>
    </article>
  );
}
