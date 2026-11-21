/**
 * The donor card: a clean, minimalist 1080×1350 shareable PNG drawn on an HTML canvas,
 * styled edge-to-edge in Blood Bridge's unified crimson, soft blush, and warm ivory palette
 * with generous whitespace and zero nested-box clutter.
 */
import type { BloodGroup } from "../../../../shared/domain";

export interface CertificateData {
  firstName: string;
  bloodGroup: BloodGroup;
  /** Donation time, epoch ms. */
  at: number;
  bankName: string;
}

export const CERT_W = 1080;
export const CERT_H = 1350;

/** Honest, non-overclaiming impact copy (shown on the card and used in share text). */
export const IMPACT_LINE = "One donation can be separated into components for more than one patient.";

const DISPLAY_FAMILY = "'Proxima Nova', 'proxima-nova', 'Nunito Sans', system-ui, -apple-system, sans-serif";
const BODY_FAMILY = "'Proxima Nova', 'proxima-nova', 'Nunito Sans', system-ui, -apple-system, sans-serif";

const THEME = {
  surface: "#FFFFFF",
  canvas: "#FAF9F6",
  blush: "#FFF5F5",
  blushSoft: "#FCEBED",
  blushBorder: "#F2D7DB",
  border: "#EAE6E3",
  ink: "#171717",
  secondary: "#737373",
  crimson: "#C93245",
  crimsonDeep: "#A82436",
  white: "#FFFFFF",
} as const;

const date = (ms: number) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }).format(ms);

const displayFont = (weight: number, size: number) => `${weight} ${size}px ${DISPLAY_FAMILY}`;
const bodyFont = (weight: number, size: number) => `${weight} ${size}px ${BODY_FAMILY}`;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function fitSize(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, min: number, maxWidth: number) {
  let size = start;
  ctx.font = displayFont(weight, size);
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = displayFont(weight, size);
  }
  return size;
}

function brandMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  const s = size / 32;
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);

  ctx.beginPath();
  ctx.moveTo(16, 1.5);
  ctx.bezierCurveTo(16, 1.5, 5, 13.2, 5, 20.2);
  ctx.arc(16, 20.2, 11, Math.PI, 0, true);
  ctx.bezierCurveTo(27, 13.2, 16, 1.5, 16, 1.5);
  ctx.closePath();
  ctx.fillStyle = THEME.crimson;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(9.6, 22.5);
  ctx.quadraticCurveTo(16, 12.5, 22.4, 22.5);
  ctx.strokeStyle = THEME.white;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.fillStyle = THEME.white;
  ctx.beginPath();
  ctx.arc(9.6, 22.6, 2.3, 0, Math.PI * 2);
  ctx.arc(22.4, 22.6, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

async function loadFonts() {
  if (!("fonts" in document)) return;
  await Promise.allSettled([
    document.fonts.load(displayFont(800, 96)),
    document.fonts.load(displayFont(700, 48)),
    document.fonts.load(bodyFont(600, 36)),
    document.fonts.load(bodyFont(500, 32)),
  ]);
}

/** Draw the minimalist editorial donor card edge-to-edge onto `canvas` (1080×1350). */
export async function drawCertificate(canvas: HTMLCanvasElement, data: CertificateData): Promise<void> {
  await loadFonts();
  canvas.width = CERT_W;
  canvas.height = CERT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  ctx.textBaseline = "alphabetic";

  const PAD = 80;
  const INNER_W = CERT_W - PAD * 2;

  // 1. Crisp warm-white full-bleed surface (no double-card frame!)
  ctx.fillStyle = THEME.surface;
  ctx.fillRect(0, 0, CERT_W, CERT_H);

  // Subtle top blush glow
  const blushWash = ctx.createLinearGradient(0, 0, 0, 420);
  blushWash.addColorStop(0, "#FFF5F5");
  blushWash.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = blushWash;
  ctx.fillRect(0, 0, CERT_W, 420);

  // Slim luminous crimson top accent bar (14px — refined, never heavy)
  const barGrad = ctx.createLinearGradient(0, 0, CERT_W, 0);
  barGrad.addColorStop(0, "#B8293B");
  barGrad.addColorStop(0.55, "#D1384B");
  barGrad.addColorStop(1, "#C93245");
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, CERT_W, 16);

  // 2. Clean Brand Row
  let y = 112;
  brandMark(ctx, PAD + 26, y - 14, 52);
  ctx.fillStyle = THEME.ink;
  ctx.font = displayFont(800, 38);
  ctx.fillText("Blood Bridge", PAD + 68, y);

  // Right-aligned soft blush badge
  const pillW = 200;
  const pillH = 48;
  const pillX = CERT_W - PAD - pillW;
  const pillY = y - 38;
  ctx.fillStyle = THEME.blushSoft;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 999);
  ctx.fill();
  ctx.fillStyle = THEME.crimsonDeep;
  ctx.font = displayFont(700, 21);
  ctx.textAlign = "center";
  ctx.fillText("DONOR CARD", pillX + pillW / 2, pillY + 31);
  ctx.textAlign = "left";

  // Hairline rule
  y += 42;
  ctx.fillStyle = THEME.border;
  ctx.fillRect(PAD, y, INNER_W, 2);

  // 3. Generous Thank-You Headline
  y += 146;
  ctx.fillStyle = THEME.ink;
  ctx.font = displayFont(800, 92);
  ctx.fillText("Thank you,", PAD, y);

  y += 108;
  fitSize(ctx, `${data.firstName}.`, 800, 102, 58, INNER_W);
  ctx.fillStyle = THEME.crimson;
  ctx.fillText(`${data.firstName}.`, PAD, y);

  // 4. Unified Clean Summary Strip (single soft blush panel — no sub-boxes!)
  y += 72;
  const PANEL_Y = y;
  const PANEL_H = 380;
  ctx.fillStyle = THEME.blush;
  ctx.beginPath();
  ctx.roundRect(PAD, PANEL_Y, INNER_W, PANEL_H, 28);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = THEME.blushBorder;
  ctx.stroke();

  // Left: Blood Group column
  const SPLIT_X = PAD + 320;
  const groupMidX = PAD + 160;
  const displayGroup = data.bloodGroup.replace("-", "−");
  const neg = data.bloodGroup.endsWith("-");

  ctx.textAlign = "center";
  ctx.fillStyle = THEME.secondary;
  ctx.font = bodyFont(700, 22);
  ctx.fillText("BLOOD GROUP", groupMidX, PANEL_Y + 72);

  const gSize = fitSize(ctx, displayGroup, 800, 152, 104, 260);
  ctx.fillStyle = THEME.crimson;
  ctx.fillText(displayGroup, groupMidX, PANEL_Y + 128 + gSize * 0.68);

  ctx.fillStyle = THEME.crimsonDeep;
  ctx.font = bodyFont(600, 26);
  ctx.fillText(neg ? "RhD negative" : "RhD positive", groupMidX, PANEL_Y + PANEL_H - 56);
  ctx.textAlign = "left";

  // Vertical soft divider inside the single panel
  ctx.fillStyle = THEME.blushBorder;
  ctx.fillRect(SPLIT_X, PANEL_Y + 48, 2, PANEL_H - 96);

  // Right: Date & Blood Bank metadata
  const DX = SPLIT_X + 52;
  const DW = PAD + INNER_W - DX - 44;

  ctx.fillStyle = THEME.secondary;
  ctx.font = bodyFont(700, 22);
  ctx.fillText("DONATED ON", DX, PANEL_Y + 78);

  ctx.fillStyle = THEME.ink;
  ctx.font = displayFont(700, 42);
  ctx.fillText(date(data.at), DX, PANEL_Y + 132);

  ctx.fillStyle = THEME.secondary;
  ctx.font = bodyFont(700, 22);
  ctx.fillText("BLOOD BANK", DX, PANEL_Y + 214);

  ctx.fillStyle = THEME.ink;
  ctx.font = displayFont(700, 36);
  let bankLines = wrap(ctx, data.bankName, DW);
  if (bankLines.length > 3) {
    bankLines = bankLines.slice(0, 3);
    bankLines[2] = `${bankLines[2].replace(/\s+\S*$/, "")}…`;
  }
  bankLines.forEach((line, idx) => {
    ctx.fillText(line, DX, PANEL_Y + 264 + idx * 46);
  });

  // 5. Clean Impact Note (open whitespace, no extra box!)
  y = PANEL_Y + PANEL_H + 92;
  ctx.fillStyle = THEME.ink;
  ctx.font = bodyFont(500, 36);
  for (const line of wrap(ctx, IMPACT_LINE, INNER_W)) {
    ctx.fillText(line, PAD, y);
    y += 52;
  }

  // 6. Clean Footer
  const FY = CERT_H - 168;
  ctx.fillStyle = THEME.border;
  ctx.fillRect(PAD, FY, INNER_W, 2);

  const hostUrl = `${window.location.host}/donor`;
  ctx.font = bodyFont(600, 30);
  ctx.fillStyle = THEME.ink;
  const prefix = "Become a donor · ";
  ctx.fillText(prefix, PAD, FY + 62);
  const prefixW = ctx.measureText(prefix).width;
  ctx.fillStyle = THEME.crimsonDeep;
  ctx.font = displayFont(700, 30);
  ctx.fillText(hostUrl, PAD + prefixW, FY + 62);

  ctx.font = bodyFont(500, 24);
  ctx.fillStyle = THEME.secondary;
  ctx.fillText("Simulated demo · Not a medical record", PAD, FY + 104);
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image"))), "image/png"),
  );
}

export const certificateFilename = (d: CertificateData) => {
  const day = new Date(d.at).toISOString().slice(0, 10);
  return `blood-bridge-donor-card-${day}.png`;
};
