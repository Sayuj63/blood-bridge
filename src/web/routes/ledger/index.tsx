import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, Skull } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AuditVerifyDTO } from "../../../shared/api";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { api, errorMessage } from "../../lib/api";
import { queryKeys } from "../../lib/queryKeys";
import { ChainRow } from "./ChainRow";

const PAGE = 50;

/** `/ledger` — the tamper-evident audit ledger: every action, hash-chained, verifiable in one click. */
export default function LedgerPage() {
  const qc = useQueryClient();
  const [result, setResult] = useState<AuditVerifyDTO | null>(null);
  const [tamperedSeq, setTamperedSeq] = useState<number | null>(null);

  const entries = useInfiniteQuery({
    queryKey: queryKeys.audit({ limit: PAGE }),
    queryFn: ({ pageParam, signal }) => api.audit.list({ limit: PAGE, before: pageParam }, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.length < PAGE ? undefined : last[last.length - 1]?.seq),
  });
  const rows = entries.data?.pages.flat() ?? [];

  const verify = useMutation({
    mutationFn: () => api.audit.verify(),
    onSuccess: setResult,
    onError: (e) => toast.error("Verification failed to run", { description: errorMessage(e) }),
  });

  const tamper = useMutation({
    mutationFn: () => api.demo.tamper(),
    onSuccess: ({ seq }) => {
      setResult(null);
      setTamperedSeq(seq);
      toast.warning(`Entry #${seq} was edited directly in the database. Now verify the chain.`);
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (e) => toast.error("Couldn't tamper with the ledger", { description: errorMessage(e) }),
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl">Audit ledger</h1>
          <p className="mt-2 text-ink-muted">
            Every reservation, transfer, alert and stock change is appended here. Each entry stores the hash of the one before it,
            so editing any entry breaks every link after it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={tamper.isPending}
            icon={<Skull className="size-4" aria-hidden />}
            onClick={() => tamper.mutate()}
          >
            Tamper with an entry
          </Button>
          <Button variant="primary" loading={verify.isPending} icon={<ShieldCheck className="size-4" aria-hidden />} onClick={() => verify.mutate()}>
            Verify chain
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="mt-6">
        {result ? <VerifyResult result={result} /> : null}
        {!result && tamperedSeq !== null ? (
          <p className="rounded-(--radius-control) border border-dashed border-warn/60 bg-warn-soft px-4 py-3 text-sm text-warn">
            Entry #{tamperedSeq} has been changed behind the system's back. Press “Verify chain” to see if the ledger notices.
          </p>
        ) : null}
      </div>

      <section aria-labelledby="entries-title" className="mt-8">
        <h2 id="entries-title" className="sr-only">
          Entries, newest first
        </h2>
        {entries.error ? (
          <ErrorState what="the audit ledger" error={entries.error} onRetry={() => void entries.refetch()} />
        ) : entries.isPending ? (
          <SkeletonRows rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck />}
            title="No entries yet"
            description="Reserve a unit, approve a transfer or start a surge, and each action will appear here with its hash."
          />
        ) : (
          <ol className="relative">
            {rows.map((e, i) => (
              <ChainRow
                key={e.seq}
                entry={e}
                olderHash={rows[i + 1]?.hash ?? null}
                brokenAt={result && !result.ok ? result.brokenAt : null}
                verified={result?.ok ?? false}
              />
            ))}
          </ol>
        )}
        {entries.hasNextPage ? (
          <div className="mt-4 flex justify-center">
            <Button loading={entries.isFetchingNextPage} onClick={() => void entries.fetchNextPage()}>
              Load older entries
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function VerifyResult({ result }: { result: AuditVerifyDTO }) {
  if (result.ok) {
    return (
      <div className="flex items-start gap-3 rounded-(--radius-panel) border border-ok/40 bg-ok-soft px-4 py-3 text-ok">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">Chain intact. {result.checked} entries checked.</p>
          {result.headHash ? (
            <p className="mt-0.5 font-mono text-xs break-all opacity-80">Head hash {result.headHash}</p>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div role="alert" className="flex items-start gap-3 rounded-(--radius-panel) border border-critical/40 bg-critical-soft px-4 py-3 text-critical">
      <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">
          Chain broken at entry #{result.brokenAt}. {result.checked} entries checked.
        </p>
        <p className="mt-0.5 text-sm">That entry no longer matches its hash, so it and every entry after it can't be trusted.</p>
      </div>
      <Badge tone="critical" className="ml-auto">
        Tampering detected
      </Badge>
    </div>
  );
}
