import { AlertTriangle, BookmarkCheck, CheckCircle2, Clock, Droplet, ShieldAlert } from "lucide-react";
import type { SiteStockDTO } from "../../../../shared/api";
import { cn } from "../../../lib/cn";
import { plural } from "../../../lib/format";

/** Airy 5-KPI overview strip matching Hospital Command & Donor Portal. */
export function KpiTiles({ stock }: { stock: SiteStockDTO }) {
  const { totals, cells } = stock;
  const critical = cells.filter((c) => c.level === "critical").length;
  const low = cells.filter((c) => c.level === "low").length;

  return (
    <section aria-label="Blood bank stock totals" className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
      {/* On hand */}
      <div className="b-card flex flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#737373]">On hand</span>
          <span className="grid size-7 place-items-center rounded-lg bg-[#FCEBED] text-[#C93245]">
            <Droplet className="size-3.5" aria-hidden />
          </span>
        </div>
        <div className="mt-2.5">
          <p className="b-num text-2xl font-extrabold leading-none text-[#171717]">
            {totals.onHand.toLocaleString("en-IN")}
          </p>
          <p className="mt-1.5 text-[11px] text-[#737373]">Available, in date</p>
        </div>
      </div>

      {/* Reserved */}
      <div className="b-card flex flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#737373]">Reserved</span>
          <span className="grid size-7 place-items-center rounded-lg bg-[#EEF4FF] text-[#1D5FB8]">
            <BookmarkCheck className="size-3.5" aria-hidden />
          </span>
        </div>
        <div className="mt-2.5">
          <p className={cn("b-num text-2xl font-extrabold leading-none", totals.reserved > 0 ? "text-[#1D5FB8]" : "text-[#171717]")}>
            {totals.reserved}
          </p>
          <p className="mt-1.5 text-[11px] text-[#737373]">Held for hospitals</p>
        </div>
      </div>

      {/* Expiring <=48h */}
      <div className={cn("flex flex-col justify-between p-4", totals.expiring48h > 0 ? "b-card-blush" : "b-card")}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#737373]">Expiring ≤48h</span>
          <span
            className={cn(
              "grid size-7 place-items-center rounded-lg",
              totals.expiring48h > 0 ? "bg-[#FCEBED] text-[#C93245]" : "bg-[#FAF9F6] text-[#737373]",
            )}
          >
            <Clock className="size-3.5" aria-hidden />
          </span>
        </div>
        <div className="mt-2.5">
          <p className={cn("b-num text-2xl font-extrabold leading-none", totals.expiring48h > 0 ? "text-[#C93245]" : "text-[#171717]")}>
            {totals.expiring48h}
          </p>
          <p className="mt-1.5 text-[11px] text-[#737373]">Use or transfer first</p>
        </div>
      </div>

      {/* Expiring <=7d */}
      <div className="b-card flex flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#737373]">Expiring ≤7d</span>
          <span
            className={cn(
              "grid size-7 place-items-center rounded-lg",
              totals.expiring7d > 0 ? "bg-[#FFF7ED] text-[#B45309]" : "bg-[#FAF9F6] text-[#737373]",
            )}
          >
            <AlertTriangle className="size-3.5" aria-hidden />
          </span>
        </div>
        <div className="mt-2.5">
          <p className={cn("b-num text-2xl font-extrabold leading-none", totals.expiring7d > 0 ? "text-[#B45309]" : "text-[#171717]")}>
            {totals.expiring7d}
          </p>
          <p className="mt-1.5 text-[11px] text-[#737373]">Watch list</p>
        </div>
      </div>

      {/* Critical cells */}
      <div className="b-card col-span-2 flex flex-col justify-between p-4 sm:col-span-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#737373]">Critical cells</span>
          <span
            className={cn(
              "grid size-7 place-items-center rounded-lg",
              critical > 0 ? "bg-[#FCEBED] text-[#C93245]" : "bg-[#ECFDF3] text-[#1F7A4D]",
            )}
          >
            {critical > 0 ? <ShieldAlert className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
          </span>
        </div>
        <div className="mt-2.5">
          <p className={cn("b-num text-2xl font-extrabold leading-none", critical > 0 ? "text-[#C93245]" : "text-[#1F7A4D]")}>
            {critical} <span className="text-xs font-semibold text-[#737373]">/ {cells.length}</span>
          </p>
          <p className="mt-1.5 truncate text-[11px] text-[#737373]">
            {low > 0 ? `${plural(low, "more cell")} running low` : "Group × component"}
          </p>
        </div>
      </div>
    </section>
  );
}
