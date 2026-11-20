import type { SiteStockDTO } from "../../../../shared/api";
import { Stat, type StatProps } from "../../../components/ui/Stat";
import { cn } from "../../../lib/cn";
import { plural } from "../../../lib/format";

/** Headline totals for the site. */
export function KpiTiles({ stock }: { stock: SiteStockDTO }) {
  const { totals, cells } = stock;
  const critical = cells.filter((c) => c.level === "critical").length;
  const low = cells.filter((c) => c.level === "low").length;

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-(--radius-panel) border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
      <Tile label="On hand" value={totals.onHand} unit="units" hint="Available, in date" />
      <Tile label="Reserved" value={totals.reserved} unit="units" hint="Held for hospitals" tone="info" />
      <Tile label="Expiring ≤48h" value={totals.expiring48h} unit="units" hint="Use or transfer first" tone={totals.expiring48h > 0 ? "critical" : "neutral"} />
      <Tile label="Expiring ≤7d" value={totals.expiring7d} unit="units" hint="Watch list" tone={totals.expiring7d > 0 ? "warn" : "neutral"} />
      <Tile
        label="Critical cells"
        value={critical}
        unit={`of ${cells.length}`}
        hint={low > 0 ? `${plural(low, "more cell")} running low` : "Group × component"}
        tone={critical > 0 ? "critical" : "ok"}
        className="col-span-2 lg:col-span-1"
      />
    </div>
  );
}

function Tile({ className, ...props }: StatProps) {
  return (
    <div className={cn("bg-surface px-4 py-3", className)}>
      <Stat {...props} />
    </div>
  );
}
