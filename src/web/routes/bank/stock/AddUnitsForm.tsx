import { PackagePlus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { DEMO_SHELF_LIFE_DAYS, COMPONENT_SHORT, type BloodGroup, type Component } from "../../../../shared/domain";
import { Button } from "../../../components/ui/Button";
import { api } from "../../../lib/api";
import { NumberStepper } from "../shared/NumberStepper";
import { COMPONENT_OPTIONS, GROUP_OPTIONS } from "../shared/options";
import { SelectField } from "../shared/SelectField";
import { useAction } from "../shared/useAction";

/** Log newly collected or received units. Expiry defaults to the component's shelf life. */
export function AddUnitsForm({ siteId }: { siteId: string }) {
  const [group, setGroup] = useState<BloodGroup>("O+");
  const [component, setComponent] = useState<Component>("red_cells");
  const [count, setCount] = useState(2);
  const [expiryDays, setExpiryDays] = useState("");
  const expiryId = useId();
  const days = expiryDays.trim() === "" ? undefined : Number(expiryDays);
  const expiryValid = days === undefined || (Number.isFinite(days) && days >= 0.1 && days <= 400);

  const add = useAction({
    run: () => api.sites.addUnits(siteId, { bloodGroup: group, component, count, expiresInDays: days }),
    success: (units) => `Added ${units.length} × ${group} ${COMPONENT_SHORT[component]}`,
    onDone: () => setExpiryDays(""),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (expiryValid) add.mutate(undefined);
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Add units">
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Blood group" value={group} options={GROUP_OPTIONS} onChange={setGroup} />
        <SelectField label="Component" value={component} options={COMPONENT_OPTIONS} onChange={setComponent} />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <NumberStepper label="Units" value={count} min={1} max={50} onChange={setCount} />
        <div>
          <label htmlFor={expiryId} className="block text-sm font-medium">
            Expires in (days) <span className="font-normal text-ink-faint">optional</span>
          </label>
          <input
            id={expiryId}
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0.1}
            max={400}
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            placeholder={`${DEMO_SHELF_LIFE_DAYS[component]} (default)`}
            aria-invalid={!expiryValid || undefined}
            className="focus-ring mt-1.5 h-9 w-40 rounded-(--radius-control) border border-line-strong bg-surface px-3 font-numeric text-sm aria-invalid:border-critical"
          />
        </div>
      </div>
      {!expiryValid ? <p className="text-sm text-critical">Expiry must be between 0.1 and 400 days.</p> : null}
      <Button type="submit" variant="primary" icon={<PackagePlus className="size-4" aria-hidden />} loading={add.isPending} disabled={!expiryValid}>
        Add {count} × {group} {COMPONENT_SHORT[component]}
      </Button>
    </form>
  );
}
