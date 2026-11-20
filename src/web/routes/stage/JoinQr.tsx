import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Skeleton } from "../../components/ui/Skeleton";
import { cn } from "../../lib/cn";
import { useWhatsAppContact } from "../../lib/queries";

/** A QR code for `url`, drawn in the browser. */
function Qr({ url, label, className }: { url: string; label: string; className?: string }) {
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
    <div className={cn("aspect-square w-full rounded-(--radius-control) bg-white p-3", className)}>
      {svg ? (
        // The SVG string comes from the qrcode library, not from user input.
        <div className="size-full [&>svg]:size-full" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : failed ? (
        <p className="grid size-full place-items-center text-sm text-[#06111c]">Couldn't draw the QR code. Open the link below.</p>
      ) : (
        <Skeleton className="size-full bg-[#e9eef3]" />
      )}
    </div>
  );
}

/** "+15550102030" → "+1 555 010 2030"; Indian numbers as "+91 98200 12345". */
function prettyNumber(e164: string): string {
  if (/^\+91\d{10}$/.test(e164)) return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
  if (/^\+1\d{10}$/.test(e164)) return `+1 ${e164.slice(2, 5)} ${e164.slice(5, 8)} ${e164.slice(8)}`;
  return e164;
}

/**
 * "Judges: scan to become a donor" — a QR for `${origin}/donor?join=1`. When the official
 * WhatsApp sender is configured, a second QR opens a chat with it (wa.me, prefilled JOIN).
 */
export function JoinQr() {
  const url = `${window.location.origin}/donor?join=1`;
  const contact = useWhatsAppContact();
  const wa = contact.data?.waLink && contact.data.whatsappNumber ? { link: contact.data.waLink, number: contact.data.whatsappNumber } : null;

  return (
    <section
      aria-labelledby="join-title"
      className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto rounded-(--radius-panel) border border-line bg-surface p-5 text-center"
    >
      <h2 id="join-title" className="font-display text-2xl leading-tight 2xl:text-3xl">
        Judges: scan to become a donor
      </h2>
      <Qr url={url} label={`QR code linking to ${url}`} className={wa ? "max-w-56" : "max-w-72"} />
      <p className="max-w-64 text-sm text-ink-muted">
        Consent in two taps and pick your blood group. When the surge starts, your phone gets the alert.
      </p>
      <p className="max-w-full truncate font-mono text-xs text-ink-faint">{url.replace(/^https?:\/\//, "")}</p>
      {wa ? (
        <div className="flex w-full flex-col items-center gap-2 border-t border-line pt-4">
          <h3 className="font-semibold text-ink">Or message Blood Bridge on WhatsApp</h3>
          <Qr url={wa.link} label={`QR code opening a WhatsApp chat with Blood Bridge at ${wa.number}`} className="max-w-36" />
          <p className="font-mono text-sm text-ink">{prettyNumber(wa.number)}</p>
          <p className="max-w-64 text-xs text-ink-muted">Official business sender. Send JOIN to sign up, or ask for blood, e.g. "need 2 O- near Sion".</p>
        </div>
      ) : null}
    </section>
  );
}
