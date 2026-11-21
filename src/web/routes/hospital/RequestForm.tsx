import { Search, Siren } from "lucide-react";
import { useId, type FormEvent } from "react";
import { BLOOD_GROUPS, COMPONENTS, COMPONENT_LABEL, URGENCIES, type Urgency } from "../../../shared/domain";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { spokenGroup } from "../../lib/format";
import { BLOOD_GROUP_HEX } from "../../styles/tokens";
import { ChoiceGrid } from "./ChoiceGrid";
import { NEEDED_BY_FOR_URGENCY, NEEDED_BY_OPTIONS, WARDS, type RequestFormValues } from "./formModel";
import { UnitsStepper } from "./UnitsStepper";

const URGENCY_LABEL: Record<Urgency, string> = { routine: "Routine", urgent: "Urgent", critical: "Critical" };
const COMPONENT_CHOICE_LABEL = { whole_blood: "Whole blood", red_cells: "Red cells", platelets: "Platelets", plasma: "Plasma" } as const;

const fieldLabel = "mb-1.5 block font-label text-xs uppercase tracking-wider text-ink-muted";
const control =
  "focus-ring h-11 w-full rounded-(--radius-control) border border-line bg-surface px-3 text-[0.9375rem] text-ink hover:border-line-strong";

interface RequestFormProps {
  values: RequestFormValues;
  onChange: (values: RequestFormValues) => void;
  onSearch: (values: RequestFormValues) => void;
  /** Omitted while a request is open: its tracker owns the critical alert. */
  onCritical?: (values: RequestFormValues) => void;
  criticalPending: boolean;
}

/** The request form: built to be filled in a few seconds with sensible defaults. Enter submits "Find blood". */
export function RequestForm({ values, onChange, onSearch, onCritical, criticalPending }: RequestFormProps) {
  const id = useId();
  const set = <K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) => onChange({ ...values, [key]: value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(values);
  };

  return (
    <form onSubmit={submit} aria-labelledby={`${id}-title`} className="space-y-4 p-4">
      <h2 id={`${id}-title`} className="font-display text-xl">
        Request blood
      </h2>

      <div>
        <span id={`${id}-group`} className={fieldLabel}>
          Patient blood group
        </span>
        <ChoiceGrid
          label="Patient blood group"
          labelledBy={`${id}-group`}
          columns={4}
          value={values.bloodGroup}
          onChange={(g) => set("bloodGroup", g)}
          choices={BLOOD_GROUPS.map((g) => ({
            value: g,
            label: <span className="font-numeric text-base">{g.replace("-", "−")}</span>,
            ariaLabel: spokenGroup(g),
            stripe: BLOOD_GROUP_HEX[g],
          }))}
        />
      </div>

      <div>
        <span id={`${id}-component`} className={fieldLabel}>
          Component
        </span>
        <ChoiceGrid
          label="Component"
          labelledBy={`${id}-component`}
          columns={2}
          value={values.component}
          onChange={(c) => set("component", c)}
          choices={COMPONENTS.map((c) => ({ value: c, label: COMPONENT_CHOICE_LABEL[c], ariaLabel: COMPONENT_LABEL[c] }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-units`} className={fieldLabel}>
            Units
          </label>
          <UnitsStepper id={`${id}-units`} value={values.unitsNeeded} onChange={(n) => set("unitsNeeded", n)} />
        </div>
        <div>
          <label htmlFor={`${id}-needed`} className={fieldLabel}>
            Needed within
          </label>
          <select
            id={`${id}-needed`}
            value={values.neededInMinutes}
            onChange={(e) => set("neededInMinutes", Number(e.target.value))}
            className={control}
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
        <span className={fieldLabel}>Urgency</span>
        <SegmentedControl
          label="Urgency"
          value={values.urgency}
          onChange={(u) => onChange({ ...values, urgency: u, neededInMinutes: NEEDED_BY_FOR_URGENCY[u] })}
          options={URGENCIES.map((u) => ({ value: u, label: URGENCY_LABEL[u] }))}
          className="flex w-full [&>button]:h-9"
        />
      </div>

      <div>
        <label htmlFor={`${id}-ward`} className={fieldLabel}>
          Ward
        </label>
        <input
          id={`${id}-ward`}
          list={`${id}-wards`}
          value={values.ward}
          maxLength={60}
          onChange={(e) => set("ward", e.target.value)}
          onFocus={(e) => e.target.select()}
          className={control}
          autoComplete="off"
        />
        <datalist id={`${id}-wards`}>
          {WARDS.map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2 pt-1">
        <Button type="submit" variant="primary" size="xl" className="w-full" icon={<Search className="size-5" aria-hidden />}>
          Find blood
        </Button>
        {values.urgency === "critical" && onCritical ? (
          <Button
            variant="danger"
            size="lg"
            className="w-full"
            loading={criticalPending}
            icon={<Siren className="size-4" aria-hidden />}
            onClick={() => onCritical(values)}
          >
            Critical — alert everyone
          </Button>
        ) : null}
      </div>
    </form>
  );
}
