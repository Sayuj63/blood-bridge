import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Skeleton } from "../../components/ui/Skeleton";

/** "Judges: scan to become a donor" — a QR for `${origin}/donor?join=1`, generated in the browser. */
export function JoinQr() {
  const url = `${window.location.origin}/donor?join=1`;
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#06111c", light: "#ffffff" } })
      .then((s) => !cancelled && setSvg(s))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <section aria-labelledby="join-title" className="flex h-full flex-col items-center justify-center gap-5 rounded-(--radius-panel) border border-line bg-surface p-5 text-center">
      <h2 id="join-title" className="font-display text-2xl leading-tight 2xl:text-3xl">
        Judges: scan to become a donor
      </h2>
      <div className="aspect-square w-full max-w-72 rounded-(--radius-control) bg-white p-3">
        {svg ? (
          // The SVG string comes from the qrcode library, not from user input.
          <div className="size-full [&>svg]:size-full" role="img" aria-label={`QR code linking to ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : failed ? (
          <p className="grid size-full place-items-center text-sm text-[#06111c]">Couldn't draw the QR code. Open the link below.</p>
        ) : (
          <Skeleton className="size-full bg-[#e9eef3]" />
        )}
      </div>
      <p className="max-w-64 text-sm text-ink-muted">
        Consent in two taps and pick your blood group. When the surge starts, your phone gets the alert.
      </p>
      <p className="max-w-full truncate font-mono text-xs text-ink-faint">{url.replace(/^https?:\/\//, "")}</p>
    </section>
  );
}
