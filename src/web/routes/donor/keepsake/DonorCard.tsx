import { Download, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { DonorDTO } from "../../../../shared/api";
import { Button, buttonVariants } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { cn } from "../../../lib/cn";
import { firstName, formatDate } from "../copy";
import { IMPACT_LINE, canvasToPng, certificateFilename, drawCertificate, type CertificateData } from "./certificate";
import { downloadBlob, inviteUrl, whatsappShare } from "./links";

export interface Donation {
  at: number;
  siteName: string;
}

const shareText = (d: CertificateData, donorId: string) =>
  `I gave blood at ${d.bankName} on ${formatDate(d.at)}. ${IMPACT_LINE} Blood Bridge alerts nearby donors when their group is needed (simulated demo): ${inviteUrl(donorId)}`;

/**
 * The shareable donor card for one donation: a PNG preview drawn in the browser,
 * with Share (system share sheet with the image, else download) and WhatsApp.
 */
export function DonorCard({ donor, donation, className }: { donor: DonorDTO; donation: Donation; className?: string }) {
  const data: CertificateData = { firstName: firstName(donor.name), bloodGroup: donor.bloodGroup, at: donation.at, bankName: donation.siteName };
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [png, setPng] = useState<{ blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { firstName: fname, bloodGroup, at, bankName } = data;

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    drawCertificate(canvas, { firstName: fname, bloodGroup, at, bankName })
      .then(() => canvasToPng(canvas))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPng({ blob, url });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fname, bloodGroup, at, bankName]);

  const filename = certificateFilename(data);

  const share = async () => {
    if (!png) return;
    const file = new File([png.blob], filename, { type: "image/png" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      setSharing(true);
      try {
        await navigator.share({ files: [file], title: "My Blood Bridge donor card", text: shareText(data, donor.id) });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        setSharing(false);
      }
    }
    downloadBlob(png.blob, filename);
    toast.success("Donor card saved. Share it from your photos or downloads.");
  };

  const alt = `Donor card: thank you, ${data.firstName}. Blood group ${donor.bloodGroup}, donated on ${formatDate(data.at)} at ${data.bankName}. ${IMPACT_LINE} Simulated demo.`;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-(--radius-panel) border border-line bg-surface-2 shadow-panel">
        {png ? (
          <img src={png.url} alt={alt} width={1080} height={1350} className="block h-auto w-full" />
        ) : failed ? (
          <p className="grid aspect-[4/5] place-items-center px-6 text-center text-sm text-ink-muted">
            Couldn't draw your donor card in this browser.
          </p>
        ) : (
          <Skeleton className="aspect-[4/5] w-full rounded-none" aria-label="Drawing your donor card" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" size="lg" className="w-full" disabled={!png} loading={sharing} icon={<Share2 className="size-4" aria-hidden />} onClick={() => void share()}>
          Share
        </Button>
        <a
          href={whatsappShare(shareText(data, donor.id))}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full px-3")}
        >
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
          <span className="sr-only">: share on WhatsApp (opens in a new tab)</span>
        </a>
      </div>
      <Button
        variant="ghost"
        size="md"
        className="mx-auto flex h-11"
        disabled={!png}
        icon={<Download className="size-4" aria-hidden />}
        onClick={() => png && downloadBlob(png.blob, filename)}
      >
        Save image
      </Button>
    </div>
  );
}
