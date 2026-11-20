import { useSearchParams } from "react-router";
import type { SiteStockDTO } from "../../../shared/api";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { useTransferBoard } from "../../lib/queries";
import { StockTable } from "./dashboard/StockTable";
import { DonorDrivePanel } from "./donors/DonorDrivePanel";
import { useIncomingDonors } from "./hooks";
import { Tabs, type TabItem } from "./shared/Tabs";
import { UpdateStockPanel } from "./stock/UpdateStockPanel";
import { TransfersPanel } from "./transfers/TransfersPanel";

type Tab = "stock" | "update" | "transfers" | "donors";
const TAB_VALUES: readonly Tab[] = ["stock", "update", "transfers", "donors"];
const isTab = (v: string | null): v is Tab => v !== null && (TAB_VALUES as readonly string[]).includes(v);

const count = (n: number | undefined, tone: "bridge" | "accent") =>
  n ? (
    <Badge tone={tone} size="sm" className="font-numeric">
      {n}
    </Badge>
  ) : null;

/** The bank's work areas. The active tab lives in `?tab=` so a demo link opens on the right one. */
export function BankTabs({ stock }: { stock: SiteStockDTO }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = isTab(raw) ? raw : "stock";
  const siteId = stock.site.id;
  const transfers = useTransferBoard(siteId).data;
  const incoming = useIncomingDonors(siteId).data;
  const pendingTransfers = (transfers?.suggestions.length ?? 0) + (transfers?.active.filter((t) => t.status === "approved").length ?? 0);

  const tabs: TabItem<Tab>[] = [
    { value: "stock", label: "Stock" },
    { value: "update", label: "Update stock" },
    { value: "transfers", label: "Transfers", badge: count(pendingTransfers, "bridge") },
    { value: "donors", label: "Donor drive", badge: count(incoming?.length, "accent") },
  ];

  const select = (next: Tab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", next);
        return p;
      },
      { replace: true },
    );

  return (
    <Card as="section" aria-label="Bank work areas" className="px-4 pb-4">
      <Tabs label="Bank work areas" tabs={tabs} value={tab} onChange={select}>
        {tab === "stock" ? <StockTable cells={stock.cells} /> : null}
        {tab === "update" ? <UpdateStockPanel stock={stock} /> : null}
        {tab === "transfers" ? <TransfersPanel siteId={siteId} units={stock.units} /> : null}
        {tab === "donors" ? <DonorDrivePanel siteId={siteId} cells={stock.cells} /> : null}
      </Tabs>
    </Card>
  );
}
