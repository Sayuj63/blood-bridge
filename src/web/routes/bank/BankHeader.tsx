import { MapPin, Phone } from "lucide-react";
import type { SiteDTO } from "../../../shared/api";
import { FreshnessPill } from "../../components/ui/FreshnessPill";
import { SelectField } from "./shared/SelectField";

export interface BankHeaderProps {
  site: SiteDTO;
  banks: readonly SiteDTO[];
  onSelect: (siteId: string) => void;
}

/** Which bank the operator is acting as, where it is, and how fresh its stock count is. */
export function BankHeader({ site, banks, onSelect }: BankHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="font-label text-xs tracking-wide text-ink-faint uppercase">Blood bank operations</p>
        <h1 className="mt-0.5 truncate text-2xl leading-tight font-bold tracking-tight">{site.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{site.address || site.areaName}</span>
          </span>
          {site.phone ? (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3.5" aria-hidden />
              {site.phone}
            </span>
          ) : null}
          <FreshnessPill lastSyncAt={site.lastSyncAt} />
        </p>
      </div>
      <SelectField
        label="Acting as"
        value={site.id}
        options={banks.map((b) => ({ value: b.id, label: b.name }))}
        onChange={onSelect}
        className="w-full md:w-72"
      />
    </div>
  );
}
