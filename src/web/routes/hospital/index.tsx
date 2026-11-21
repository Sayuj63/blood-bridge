import { useQuery } from "@tanstack/react-query";
import { Hospital } from "lucide-react";
import { useMemo, useState } from "react";
import type { BloodGroup, Component } from "../../../shared/domain";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { api } from "../../lib/api";
import { useForecast, useTransferBoard } from "../../lib/queries";
import { queryKeys } from "../../lib/queryKeys";
import { DonorDriveDialog } from "../command/DonorDriveDialog";
import { CompatibilityDialog } from "./CompatibilityDialog";
import { HospitalInventory } from "./HospitalInventory";
import { HospitalLayout } from "./HospitalLayout";
import { HospitalOverview } from "./HospitalOverview";
import { HospitalTransfersView } from "./HospitalTransfersView";
import { PredictiveInsights } from "./PredictiveInsights";
import { ReservationsView } from "./ReservationsView";
import { classifyOutlookRisk } from "./forecastUtils";
import { DEFAULT_FORM, type RequestFormValues } from "./formModel";
import "./hospital.css";
import { useHospitalView } from "./useHospitalView";

/**
 * Redesigned Hospital Operations Command Desk:
 * Overview (with integrated Find Blood) · Blood Inventory · Predictive Insights · Reservations · Transfers
 * Strictly frontend-only, connected end-to-end to existing Blood Bridge APIs and realtime WebSockets.
 */
export default function HospitalView() {
  const { sites, hospitals, hospital, requestId, section, embed, selectHospital, openRequest, setSection } = useHospitalView();
  const [formValues, setFormValues] = useState<RequestFormValues>(DEFAULT_FORM);
  const [autoSearchToken, setAutoSearchToken] = useState(0);
  const [scrollToFindToken, setScrollToFindToken] = useState(0);
  const [selectedInsightLine, setSelectedInsightLine] = useState<{ bloodGroup: BloodGroup; component: Component } | null>(null);
  const [compatOpen, setCompatOpen] = useState(false);
  const [donorDrive, setDonorDrive] = useState<{ open: boolean; group: BloodGroup; bankId?: string }>({
    open: false,
    group: "O-",
  });

  const forecast = useForecast();
  const board = useTransferBoard();

  const stock = useQuery({
    queryKey: hospital ? queryKeys.stock(hospital.id) : ["stock", "none"],
    queryFn: ({ signal }) => api.sites.stock(hospital!.id, signal),
    enabled: hospital !== null,
  });

  const requests = useQuery({
    queryKey: hospital ? queryKeys.requests(hospital.id) : ["requests", "list", "none"],
    queryFn: ({ signal }) => api.requests.list(hospital!.id, signal),
    enabled: hospital !== null,
  });

  const allSites = sites.data ?? [];
  const banks = useMemo(() => allSites.filter((s) => s.kind === "blood_bank"), [allSites]);
  const requestList = requests.data ?? [];

  const activeRequestCount = useMemo(() => requestList.filter((r) => r.status === "open").length, [requestList]);
  const atRiskCount = useMemo(
    () => (forecast.data?.outlook ?? []).filter((o) => classifyOutlookRisk(o) !== "sufficient").length,
    [forecast.data],
  );

  const lastInventorySyncAt = useMemo(() => {
    const timestamps = [stock.data?.site.lastSyncAt, ...banks.map((b) => b.lastSyncAt)].filter(
      (t): t is number => typeof t === "number" && t > 0,
    );
    return timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
  }, [stock.data, banks]);

  const handleJumpToFindBlood = () => {
    setSection("overview");
    setScrollToFindToken((n) => n + 1);
  };

  const handleFindGroup = (bloodGroup: BloodGroup, component?: Component) => {
    setFormValues((prev) => ({
      ...prev,
      bloodGroup,
      component: component ?? prev.component,
    }));
    setAutoSearchToken((n) => n + 1);
    setScrollToFindToken((n) => n + 1);
    setSection("overview");
  };

  const handleInspectGroup = (bloodGroup: BloodGroup, component: Component) => {
    setSelectedInsightLine({ bloodGroup, component });
    setSection("insights");
  };

  if (sites.isPending) {
    return (
      <div className="hospital-theme flex flex-1 p-6" aria-busy="true">
        <div className="mx-auto w-full max-w-[92rem] space-y-4">
          <Skeleton className="h-14 w-80 rounded-xl" />
          <Skeleton className="h-52 rounded-[20px]" />
          <div className="grid gap-4 lg:grid-cols-12">
            <Skeleton className="h-80 rounded-xl lg:col-span-7" />
            <Skeleton className="h-80 rounded-xl lg:col-span-5" />
          </div>
        </div>
      </div>
    );
  }

  if (sites.isError) {
    return (
      <div className="hospital-theme flex flex-1 items-center justify-center p-6">
        <ErrorState what="the list of facilities" error={sites.error} onRetry={() => void sites.refetch()} />
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="hospital-theme flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={<Hospital />}
          title="No hospitals registered"
          description="Load the Mumbai demo data to populate hospitals and blood banks."
        />
      </div>
    );
  }

  return (
    <HospitalLayout
      hospital={hospital}
      hospitals={hospitals}
      onSelectHospital={selectHospital}
      section={section}
      onSection={setSection}
      embed={embed}
      activeRequestCount={activeRequestCount}
      atRiskCount={atRiskCount}
      transferSuggestionCount={board.data?.suggestions.length ?? 0}
      lastInventorySyncAt={lastInventorySyncAt}
      onJumpToFindBlood={handleJumpToFindBlood}
      onOpenCompatibility={() => setCompatOpen(true)}
    >
      {section === "overview" ? (
        <HospitalOverview
          hospital={hospital}
          sites={allSites}
          stock={stock.data}
          stockLoading={stock.isPending}
          forecast={forecast.data}
          forecastLoading={forecast.isPending}
          requests={requestList}
          embed={embed}
          formValues={formValues}
          onFormChange={setFormValues}
          autoSearchToken={autoSearchToken}
          scrollToFindToken={scrollToFindToken}
          onNavigate={setSection}
          onFindGroup={handleFindGroup}
          onInspectGroup={handleInspectGroup}
          onOpenRequest={(id) => openRequest(id)}
          onOpenCompatibility={() => setCompatOpen(true)}
        />
      ) : section === "inventory" ? (
        <HospitalInventory
          key={hospital.id}
          hospital={hospital}
          stock={stock.data}
          stockLoading={stock.isPending}
          stockError={stock.error}
          onRetryStock={() => void stock.refetch()}
          forecast={forecast.data}
          onFindGroup={handleFindGroup}
        />
      ) : section === "insights" ? (
        <PredictiveInsights
          hospital={hospital}
          sites={allSites}
          forecast={forecast.data}
          forecastLoading={forecast.isPending}
          forecastError={forecast.error}
          onRetryForecast={() => void forecast.refetch()}
          board={board.data}
          selectedLine={selectedInsightLine}
          onSelectLine={setSelectedInsightLine}
          onFindGroup={handleFindGroup}
          onOpenDonorDrive={(group, bankId) => setDonorDrive({ open: true, group, bankId })}
        />
      ) : section === "reservations" ? (
        <ReservationsView
          key={hospital.id}
          hospital={hospital}
          requests={requestList}
          requestsLoading={requests.isPending}
          requestsError={requests.error}
          onRetryRequests={() => void requests.refetch()}
          selectedId={requestId}
          onSelect={openRequest}
          onNewRequest={handleJumpToFindBlood}
        />
      ) : (
        <HospitalTransfersView
          hospital={hospital}
          sites={allSites}
          board={board.data}
          boardLoading={board.isPending}
          boardError={board.error}
          onRetryBoard={() => void board.refetch()}
        />
      )}

      <CompatibilityDialog open={compatOpen} onClose={() => setCompatOpen(false)} component={formValues.component} />
      <DonorDriveDialog
        open={donorDrive.open}
        onClose={() => setDonorDrive((prev) => ({ ...prev, open: false }))}
        banks={banks}
        defaultBankId={donorDrive.bankId}
        defaultGroup={donorDrive.group}
      />
    </HospitalLayout>
  );
}
