import { Grid3x3 } from "lucide-react";
import { useId } from "react";
import type { SiteDTO } from "../../../shared/api";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import type { HospitalTab } from "./useHospitalView";

interface HospitalHeaderProps {
  hospital: SiteDTO;
  hospitals: SiteDTO[];
  onSelectHospital: (id: string) => void;
  tab: HospitalTab;
  onTab: (tab: HospitalTab) => void;
  onOpenCompatibility: () => void;
}

/** Acting-as hospital picker, view switch and the compatibility table. */
export function HospitalHeader({ hospital, hospitals, onSelectHospital, tab, onTab, onOpenCompatibility }: HospitalHeaderProps) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block font-label text-xs uppercase tracking-wider text-ink-muted">
          Acting as
        </label>
        <select
          id={id}
          value={hospital.id}
          onChange={(e) => onSelectHospital(e.target.value)}
          className="focus-ring -ml-1 max-w-full cursor-pointer rounded-md field-sizing-content bg-transparent px-1 font-display text-2xl leading-tight text-ink hover:bg-surface-2"
        >
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-ink-muted">
          {hospital.areaName} · {hospital.address}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Hospital view"
          value={tab}
          onChange={onTab}
          options={[
            { value: "overview", label: "Request blood" },
            { value: "inventory", label: "Our stock" },
          ]}
        />
        <Button size="md" variant="ghost" onClick={onOpenCompatibility} icon={<Grid3x3 className="size-4" aria-hidden />}>
          Compatibility
        </Button>
      </div>
    </div>
  );
}
