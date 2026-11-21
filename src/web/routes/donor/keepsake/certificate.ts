/**
 * The donor card: a 1080×1350 PNG drawn on a canvas in the browser, laid out like
 * a blood-bag label (an ABO/Rh quadrant beside the donation details). No server.
 */
import type { BloodGroup } from "../../../../shared/domain";
import { BLOOD_GROUP_HEX, BLOOD_GROUP_ON } from "../../../styles/tokens";

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

const FAMILY = "'Archivo Variable', Archivo, system-ui, sans-serif";

/** Theme tokens, read live from CSS so the card follows the design system. */
function tokens() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    surface: v("--bb-surface", "#ffffff"),
    surface2: v("--bb-surface-2", "#e9eef3"),
    line: v("--bb-line", "#cfd8e1"),
    lineStrong: v("--bb-line-strong", "#9fb0c0"),
    ink: v("--bb-ink", "#0d1b2a"),
    muted: v("--bb-ink-muted", "#42556a"),
    faint: v("--bb-ink-faint", "#627387"),
    accent: v("--bb-accent", "#b0122c"),
    accentInk: v("--bb-accent-ink", "#ffffff"),
  };
}

const date = (ms: number) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }).format(ms);

/** `stretch` is a CSS font-stretch keyword: Archivo's width axis carries display vs label. */
const font = (weight: number, size: number, stretch = "normal") => `${stretch} ${weight} ${size}px ${FAMILY}`;

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

/** Shrink a single line's font size until it fits. */
function fitSize(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, min: number, maxWidth: number, stretch?: string) {
  let size = start;
  ctx.font = font(weight, size, stretch);
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = font(weight, size, stretch);
  }
  return size;
}

function droplet(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string) {
  const w = h * 0.72;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.bezierCurveTo(w * 0.5, h * 0.18, w, h * 0.42, w, h * 0.64);
  ctx.arc(w / 2, h * 0.64, w / 2, 0, Math.PI, false);
  ctx.bezierCurveTo(0, h * 0.42, w * 0.5, h * 0.18, w / 2, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

async function loadFonts() {
  if (!("fonts" in document)) return;
  await Promise.allSettled([
    document.fonts.load(font(800, 100, "expanded")),
    document.fonts.load(font(700, 100, "condensed")),
    document.fonts.load(font(500, 40)),
  ]);
}

/** Draw the card onto `canvas` (resized to 1080×1350). */
export async function drawCertificate(canvas: HTMLCanvasElement, data: CertificateData): Promise<void> {
  await loadFonts();
  const t = tokens();
  canvas.width = CERT_W;
  canvas.height = CERT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  ctx.textBaseline = "alphabetic";

  // Paper.
  ctx.fillStyle = t.surface2;
  ctx.fillRect(0, 0, CERT_W, CERT_H);

  // The label itself, inset like a sticker on the bag.
  const M = 56;
  const X0 = M;
  const X1 = CERT_W - M;
  const W = X1 - X0;
  const PAD = 56;
  ctx.fillStyle = t.surface;
  ctx.beginPath();
  ctx.roundRect(X0, M, W, CERT_H - 2 * M, 28);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = t.lineStrong;
  ctx.stroke();

  // Brand row.
  let y = M + 64;
  droplet(ctx, X0 + PAD, y - 46, 58, t.accent);
  ctx.fillStyle = t.ink;
  ctx.font = font(800, 40, "expanded");
  ctx.fillText("Blood Bridge", X0 + PAD + 58, y);
  ctx.font = font(700, 30, "condensed");
  ctx.fillStyle = t.muted;
  ctx.textAlign = "right";
  ctx.fillText("Donor card", X1 - PAD, y - 4);
  ctx.textAlign = "left";

  y += 44;
  ctx.fillStyle = t.ink;
  ctx.fillRect(X0, y, W, 3);

  // Thank-you headline in the expanded display cut.
  y += 130;
  ctx.font = font(800, 96, "expanded");
  ctx.fillText("Thank you,", X0 + PAD, y);
  y += 112;
  fitSize(ctx, `${data.firstName}.`, 800, 112, 60, W - 2 * PAD, "expanded");
  ctx.fillStyle = t.accent;
  ctx.fillText(`${data.firstName}.`, X0 + PAD, y);

  // Quadrant: ABO/Rh box (group colour) | donation details.
  y += 70;
  const QTOP = y;
  const QH = 440;
  const QSPLIT = X0 + 400;
  ctx.fillStyle = t.ink;
  ctx.fillRect(X0, QTOP, W, 3);
  ctx.fillRect(X0, QTOP + QH, W, 3);
  ctx.fillRect(QSPLIT, QTOP, 3, QH);

  const abo = data.bloodGroup.slice(0, -1);
  const neg = data.bloodGroup.endsWith("-");
  ctx.fillStyle = BLOOD_GROUP_HEX[data.bloodGroup];
  ctx.fillRect(X0 + 3, QTOP + 3, QSPLIT - X0 - 3, QH - 3);
  ctx.fillStyle = BLOOD_GROUP_ON[data.bloodGroup];
  ctx.textAlign = "center";
  const boxMid = (X0 + QSPLIT) / 2;
  const aboSize = fitSize(ctx, abo, 800, 260, 120, QSPLIT - X0 - 60, "condensed");
  ctx.fillText(abo, boxMid, QTOP + 70 + aboSize * 0.78);
  ctx.font = font(700, 40, "condensed");
  ctx.fillText(neg ? "RhD negative" : "RhD positive", boxMid, QTOP + QH - 48);
  ctx.textAlign = "left";

  // Details column.
  const DX = QSPLIT + 48;
  const DW = X1 - PAD - DX;
  const field = (label: string, value: string, top: number, maxLines: number) => {
    ctx.font = font(700, 28, "condensed");
    ctx.fillStyle = t.muted;
    ctx.fillText(label, DX, top);
    ctx.font = font(650, 44, "semi-condensed");
    ctx.fillStyle = t.ink;
    let lines = wrap(ctx, value, DW);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, "")}…`;
    }
    lines.forEach((l, i) => ctx.fillText(l, DX, top + 56 + i * 52));
    return top + 56 + (lines.length - 1) * 52;
  };
  const fy = field("Donated on", date(data.at), QTOP + 80, 1);
  field("At", data.bankName, fy + 82, 3);

  // Impact line.
  y = QTOP + QH + 96;
  ctx.font = font(500, 40);
  ctx.fillStyle = t.ink;
  for (const line of wrap(ctx, IMPACT_LINE, W - 2 * PAD)) {
    ctx.fillText(line, X0 + PAD, y);
    y += 54;
  }

  // Footer: perforation, invite line, small print.
  const FY = CERT_H - M - 112;
  ctx.setLineDash([14, 12]);
  ctx.strokeStyle = t.lineStrong;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(X0 + PAD, FY);
  ctx.lineTo(X1 - PAD, FY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = font(650, 32, "semi-condensed");
  ctx.fillStyle = t.ink;
  ctx.fillText(`Become a donor: ${window.location.host}/donor`, X0 + PAD, FY + 56);
  ctx.font = font(500, 24);
  ctx.fillStyle = t.faint;
  ctx.fillText("Simulated demo. Not a medical record.", X0 + PAD, FY + 92);
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
