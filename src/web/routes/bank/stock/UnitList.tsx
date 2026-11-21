import { Camera, ScanLine } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { CameraScanner } from "./CameraScanner";
import type { UnitDTO } from "../../../../shared/api";
import type { BloodGroup, Component } from "../../../../shared/domain";
import { EmptyState } from "../../../components/ui/EmptyState";
import { COMPONENT_OPTIONS, GROUP_OPTIONS } from "../shared/options";
import { SelectField } from "../shared/SelectField";
import { UnitRow } from "./UnitRow";
import { filterUnits, type ExpiryWindow } from "./filterUnits";

const MAX_ROWS = 40;
const WINDOW_OPTIONS = [
  { value: "all", label: "Any expiry" },
  { value: "48h", label: "Expiring ≤48h" },
  { value: "7d", label: "Expiring ≤7d" },
] as const;

/** Filterable list of units on the shelf, with a scan box that finds a unit by ID. */
export function UnitList({ units }: { units: UnitDTO[] }) {
  const [scan, setScan] = useState("");
  const [group, setGroup] = useState<BloodGroup | "all">("all");
  const [component, setComponent] = useState<Component | "all">("all");
  const [expiry, setExpiry] = useState<ExpiryWindow>("all");
  const scanId = useId();
  const [camera, setCamera] = useState(false);
  const closeCamera = useCallback(() => setCamera(false), []);

  const matches = filterUnits(units, { scan, group, component, window: expiry });
  const exact = scan.trim() ? matches.find((u) => u.id.toLowerCase() === scan.trim().toLowerCase()) : undefined;
  const shown = matches.slice(0, MAX_ROWS);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={scanId} className="block text-sm font-medium">
          Scan unit ID
        </label>
        <div className="mt-1.5 flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            id={scanId}
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder="Scan the bag barcode or type part of the ID"
            className="focus-ring h-10 w-full rounded-(--radius-control) border border-line-strong bg-surface pr-3 pl-9 font-mono text-sm"
          />
        </div>
        <Button icon={<Camera className="size-4" aria-hidden />} onClick={() => setCamera(true)} aria-label="Scan with camera">
          Camera
        </Button>
        </div>
        {camera ? <CameraScanner open onClose={closeCamera} onScan={setScan} /> : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SelectField hideLabel label="Filter by group" value={group} options={[{ value: "all", label: "All groups" }, ...GROUP_OPTIONS]} onChange={setGroup} />
        <SelectField hideLabel label="Filter by component" value={component} options={[{ value: "all", label: "All components" }, ...COMPONENT_OPTIONS]} onChange={setComponent} />
        <SelectField hideLabel label="Filter by expiry" value={expiry} options={WINDOW_OPTIONS} onChange={setExpiry} />
      </div>
      <p className="text-xs text-ink-muted" aria-live="polite">
        {exact ? `Found unit ${exact.id}` : `${matches.length} units`}
        {matches.length > MAX_ROWS ? ` · showing the ${MAX_ROWS} expiring soonest` : ""}
      </p>
      {shown.length === 0 ? (
        <EmptyState compact title="No units match" description={scan ? "Check the ID, or clear the filters." : "Try a wider filter."} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-(--radius-control) border border-line">
          {shown.map((u) => (
            <UnitRow key={u.id} unit={u} highlight={u.id === exact?.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
