/** Outbound links the donor view builds: invites, WhatsApp, file downloads. All client-side. */

/** The donor page. */
export const donorPageUrl = (): string => `${window.location.origin}/donor`;

/** A friend invite: opens the quick join and carries the inviter's id. */
export const inviteUrl = (donorId: string): string =>
  `${window.location.origin}/donor?join=1&ref=${encodeURIComponent(donorId)}`;

/** WhatsApp click-to-share with prefilled text; the recipient is picked inside WhatsApp. */
export const whatsappShare = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Save a Blob as a file through a temporary link. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before freeing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}
