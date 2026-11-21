import { toDataURL } from "qrcode";
import { useEffect, useState } from "react";
import type { UnitDTO } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { Dialog } from "../../../components/ui/Dialog";
import { formatISTDateTime } from "../../../lib/format";

/** Printable unit label with a QR of the unit ID, so a phone camera can scan it back in. */
export function UnitLabel({ unit, open, onClose }: { unit: UnitDTO; open: boolean; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void toDataURL(unit.id, { width: 240, margin: 1 }).then(setSrc);
  }, [open, unit.id]);

  return (
    <Dialog open={open} onClose={onClose} title={`Unit label · ${unit.id}`} description="Simulated demo label. Scan it from the Stock tab.">
      <div className="mx-auto w-64 rounded-(--radius-control) border-2 border-ink p-3 text-center">
        {src ? <img src={src} alt={`QR code for unit ${unit.id}`} className="mx-auto size-48" /> : <div className="mx-auto size-48 bg-surface-2" />}
        <p className="mt-2 font-mono text-sm font-bold">{unit.id}</p>
        <p className="text-sm">
          <strong>{unit.bloodGroup}</strong> · {COMPONENT_LABEL[unit.component]}
        </p>
        <p className="text-xs text-ink-muted">Expires {formatISTDateTime(unit.expiresAt)}</p>
      </div>
    </Dialog>
  );
}
