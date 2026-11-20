/**
 * The donor profile created on this device via the stage QR quick join.
 * Browser storage can be blocked (private mode, previews), so every access is guarded.
 */
const KEY = "bb.donorId";

export function readOwnDonorId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveOwnDonorId(donorId: string): void {
  try {
    window.localStorage.setItem(KEY, donorId);
  } catch {
    // Storage unavailable: the ?donor= link still works for this visit.
  }
}

export function clearOwnDonorId(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
