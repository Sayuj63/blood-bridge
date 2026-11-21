/**
 * Original flat illustrations for the landing hero, drawn to match a classic blood-donation
 * landing layout: a raised arm with a tourniquet on the left, a hand holding a blood bag on the
 * right, red wave shapes, clouds and leaves. Palette only — no external artwork.
 */

const RED = "#A61B2B";
const RED_DARK = "#7F1422";
const PINK = "#FCEBED";
const BLUSH = "#FFF5F5";
const LINE = "#EAE6E3";
const WHITE = "#FFFFFF";

/** Heart with a medical cross — the brand mark in the header. */
export function HeartCross({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 36 C8 27 2 20 2 12.5 C2 7 6.3 3 11.5 3 C15 3 18 5 20 8 C22 5 25 3 28.5 3 C33.7 3 38 7 38 12.5 C38 20 32 27 20 36 Z" fill={RED} />
      <path d="M20 30.5 C11 23.6 7 18.6 7 13.2 C7 9.9 9.6 7.5 12.6 7.5 C15.4 7.5 17.6 9.3 20 12.6 C22.4 9.3 24.6 7.5 27.4 7.5 C30.4 7.5 33 9.9 33 13.2 C33 18.6 29 23.6 20 30.5 Z" fill={WHITE} />
      <rect x="17.4" y="11" width="5.2" height="14" rx="1.4" fill={RED} />
      <rect x="13" y="15.4" width="14" height="5.2" rx="1.4" fill={RED} />
    </svg>
  );
}

function Leaf({ x, y, r, s = 1, fill }: { x: number; y: number; r: number; s?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0 C-14 -22 -12 -52 0 -74 C12 -52 14 -22 0 0 Z" fill={fill} />
      <path d="M0 -4 L0 -66" stroke={PINK} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
    </g>
  );
}

/** A tuft of red leaves along the ground. */
export function Leaves({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 110" className={className} aria-hidden="true">
      <Leaf x={30} y={110} r={-38} s={0.9} fill={RED_DARK} />
      <Leaf x={58} y={110} r={-12} s={1.15} fill={RED} />
      <Leaf x={92} y={110} r={14} s={0.85} fill={RED_DARK} />
      <Leaf x={128} y={110} r={-24} s={1.05} fill={RED} />
      <Leaf x={160} y={110} r={20} s={1.2} fill={RED} />
      <Leaf x={194} y={110} r={42} s={0.8} fill={RED_DARK} />
    </svg>
  );
}

/** A soft paper cloud. */
export function Cloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 70" className={className} aria-hidden="true">
      <path
        d="M14 62 C2 62 0 46 12 42 C10 28 28 22 38 30 C42 12 70 8 80 26 C90 14 114 18 116 36 C130 30 148 40 142 54 C152 56 152 62 146 62 Z"
        fill={WHITE}
      />
      <path d="M14 62 L146 62 C152 62 152 66 146 66 L14 66 C8 66 8 62 14 62 Z" fill={LINE} />
    </svg>
  );
}

/** Left: a raised fist with a tourniquet and an IV line, on a red wave. */
export function ArmArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 640" className={className} aria-hidden="true" preserveAspectRatio="xMinYMax meet">
      <path
        d="M0 150 C90 120 150 95 205 135 C255 172 240 240 292 270 C345 300 410 292 425 350 C440 410 370 445 380 505 C388 560 330 600 300 640 L0 640 Z"
        fill={RED}
      />
      <path d="M0 300 C60 280 112 330 122 400 C132 470 92 520 118 640 L0 640 Z" fill={RED_DARK} opacity="0.5" />
      <path d="M0 150 C40 138 70 130 96 128 C60 150 30 190 0 214 Z" fill={PINK} opacity="0.35" />

      {/* IV line looping down from the tourniquet */}
      <path d="M182 492 C118 476 66 528 78 586 C88 636 158 648 170 604" fill="none" stroke={BLUSH} strokeWidth="7" strokeLinecap="round" />
      <circle cx="170" cy="604" r="7" fill={BLUSH} />

      {/* forearm */}
      <path d="M168 640 L204 332 C206 318 263 316 266 330 L302 640 Z" fill={BLUSH} />
      <path d="M240 330 L266 330 L302 640 L270 640 Z" fill={PINK} />

      {/* fist, front view: four curled fingers side by side, the thumb folded across them */}
      <rect x="186" y="236" width="108" height="104" rx="34" fill={BLUSH} />
      <path d="M262 236 C292 240 298 280 294 312 C290 334 276 342 258 340 Z" fill={PINK} />
      {[
        { x: 184, y: 200, h: 92 },
        { x: 211, y: 188, h: 98 },
        { x: 238, y: 190, h: 96 },
        { x: 265, y: 204, h: 84 },
      ].map((f) => (
        <g key={f.x}>
          <rect x={f.x} y={f.y} width="28" height={f.h} rx="14" fill={BLUSH} stroke={LINE} strokeWidth="2" />
          <path d={`M${f.x + 7} ${f.y + 30} Q${f.x + 14} ${f.y + 35} ${f.x + 21} ${f.y + 30}`} fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      <path d="M186 304 C196 278 228 270 258 278 C274 282 276 298 262 304 C240 312 212 314 192 320 Z" fill={BLUSH} stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
      <path d="M248 288 C254 290 258 294 258 298" fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" />

      {/* tourniquet bands */}
      <g transform="rotate(-6 240 486)">
        <rect x="176" y="466" width="128" height="16" rx="8" fill={WHITE} stroke={RED} strokeWidth="3" />
        <rect x="178" y="492" width="128" height="16" rx="8" fill={WHITE} stroke={RED} strokeWidth="3" />
      </g>
    </svg>
  );
}

/** Right: a hand holding a blood bag, on a red wave. */
export function BagArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 640" className={className} aria-hidden="true" preserveAspectRatio="xMaxYMax meet">
      <path
        d="M460 120 C380 110 330 140 300 190 C265 248 300 300 250 350 C200 400 120 390 110 460 C100 520 160 560 170 640 L460 640 Z"
        fill={RED}
      />
      <path d="M460 330 C410 340 380 400 395 470 C410 540 370 590 380 640 L460 640 Z" fill={RED_DARK} opacity="0.5" />

      <g transform="rotate(16 250 300)">
        {/* line and cap */}
        <path d="M245 20 L245 112" stroke={RED} strokeWidth="6" strokeLinecap="round" />
        <rect x="218" y="100" width="54" height="22" rx="7" fill={RED_DARK} stroke={WHITE} strokeWidth="4" />
        {/* bag */}
        <rect x="170" y="118" width="150" height="206" rx="28" fill={RED} stroke={WHITE} strokeWidth="5" />
        <rect x="184" y="138" width="16" height="150" rx="8" fill={WHITE} opacity="0.28" />
        <circle cx="245" cy="222" r="52" fill="none" stroke={WHITE} strokeWidth="3" opacity="0.55" />
        <circle cx="245" cy="222" r="42" fill={WHITE} />
        <path d="M226 203 L264 241 M264 203 L226 241" stroke={RED} strokeWidth="10" strokeLinecap="round" />

        {/* hand: palm from below, thumb on the left, fingers wrapping the right edge */}
        <path d="M262 640 L276 352 C278 330 350 326 356 348 L388 640 Z" fill={BLUSH} />
        <path d="M330 344 L356 348 L388 640 L356 640 Z" fill={PINK} />
        <rect x="160" y="250" width="30" height="86" rx="15" fill={BLUSH} />
        <path d="M168 262 L182 262" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
        {[256, 286, 316].map((y) => (
          <g key={y}>
            <rect x="282" y={y} width="64" height="28" rx="14" fill={BLUSH} />
            <path d={`M296 ${y + 14} L330 ${y + 14}`} stroke={LINE} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          </g>
        ))}
      </g>
    </svg>
  );
}

const ICONS = {
  instagram: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="15.6" cy="8.4" r="0.9" fill="currentColor" />
    </>
  ),
  facebook: <path d="M13.2 19v-6h2l.3-2.4h-2.3V9.1c0-.7.2-1.2 1.2-1.2h1.2V5.8c-.2 0-.9-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.8H8.8V13h2v6z" fill="currentColor" />,
  twitter: (
    <path
      d="M18.5 8.2c-.5.2-1 .4-1.5.4.6-.3 1-.9 1.2-1.5-.5.3-1.1.5-1.7.7a2.7 2.7 0 0 0-4.6 2.4c-2.2-.1-4.2-1.2-5.5-2.8-.7 1.2-.3 2.8.8 3.6-.4 0-.8-.1-1.2-.3 0 1.3.9 2.4 2.2 2.7-.4.1-.8.1-1.2 0 .3 1.1 1.4 1.9 2.5 1.9A5.4 5.4 0 0 1 5.5 16.3 7.6 7.6 0 0 0 9.6 17.5c5 0 7.7-4.1 7.7-7.7v-.4c.5-.4 1-.8 1.2-1.2z"
      fill="currentColor"
    />
  ),
  whatsapp: (
    <>
      <path d="M12 5.6a6.4 6.4 0 0 0-5.5 9.7L5.6 18.4l3.2-.8A6.4 6.4 0 1 0 12 5.6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 9.4c.2-.4.4-.4.6-.4h.4c.1 0 .3 0 .4.3l.5 1.2c0 .1.1.3 0 .4l-.3.4c-.1.1-.2.2-.1.4.4.7 1 1.3 1.7 1.7.2.1.3.1.4-.1l.4-.5c.1-.1.3-.1.4-.1l1.2.6c.2.1.3.2.3.3 0 .4-.1.9-.5 1.1-.4.3-1.1.4-1.9.1-1.5-.5-2.8-1.7-3.5-3.1-.4-.8-.3-1.6.0-2.2z" fill="currentColor" />
    </>
  ),
} as const;

export type SocialName = keyof typeof ICONS;

/** Round dark social icon, as in the reference header. */
export function SocialIcon({ name }: { name: SocialName }) {
  return (
    <svg viewBox="0 0 24 24" className="size-full" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#171717" />
      <g color={WHITE}>{ICONS[name]}</g>
    </svg>
  );
}
