import type { IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "../../../components/ui/Dialog";

interface CameraScannerProps {
  open: boolean;
  onClose: () => void;
  /** Called once with the decoded text (bag barcode or label QR). */
  onScan: (text: string) => void;
}

/**
 * Camera barcode / QR scanner (open-source ZXing, decoded on-device; no frames leave the browser).
 * Reads Code 128 (ISBT 128 bag labels) and QR. Loaded on demand so the bank view stays light.
 */
export function CameraScanner({ open, onClose, onScan }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let controls: IScannerControls | null = null;
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;
        controls = await new BrowserMultiFormatReader().decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (!result) return;
          controls?.stop();
          onScan(result.getText().trim());
          onClose();
        });
      } catch (err) {
        setError(err instanceof Error && err.name === "NotAllowedError" ? "Camera permission was denied." : "No camera available on this device.");
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, onScan, onClose]);

  return (
    <Dialog open={open} onClose={onClose} title="Scan a unit" description="Point the camera at the bag barcode or a Blood Bridge unit label.">
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error} Type the unit ID instead.
        </p>
      ) : (
        <video ref={videoRef} className="aspect-video w-full rounded-(--radius-control) bg-black object-cover" muted playsInline />
      )}
    </Dialog>
  );
}
