import "@fontsource-variable/playfair-display/index.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import { Link } from "react-router";
import { ArmArt, BagArt, Cloud, HeartCross, Leaves, SocialIcon, type SocialName } from "./art";
import { WORLD_PATH } from "./worldPath";

const SITE = "https://blood-bridge.blood-bridge.workers.dev";
const SHARE_TEXT = "Blood Bridge: find, reserve and donate blood across Mumbai";

const NAV = [
  { label: "Home", to: "/", active: true },
  { label: "Info", to: "#info" },
  { label: "Gallery", to: "/stage" },
  { label: "Contact", to: "#contact" },
] as const;

const SOCIALS: { name: SocialName; label: string; href: string }[] = [
  { name: "instagram", label: "Instagram", href: "https://www.instagram.com/" },
  { name: "facebook", label: "Share on Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE)}` },
  { name: "twitter", label: "Share on X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SITE)}` },
  { name: "whatsapp", label: "Share on WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${SITE}`)}` },
];

/** Landing hero: centred serif headline between a raised arm and a hand holding a blood bag. */
export function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[#FAF9F6] font-[family-name:var(--font-poppins)] text-[#171717]">
      {/* faint world map */}
      <svg
        viewBox="0 0 1000 500"
        className="pointer-events-none absolute top-[9%] left-1/2 -z-10 w-[min(1180px,96%)] -translate-x-1/2"
        aria-hidden="true"
      >
        <path d={WORLD_PATH} fill="#EAE6E3" />
      </svg>

      {/* art */}
      <ArmArt className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[46%] w-auto max-w-[58%] md:h-[80%] md:max-w-[40%]" />
      <BagArt className="pointer-events-none absolute right-0 bottom-0 -z-10 h-[48%] w-auto max-w-[56%] md:h-[82%] md:max-w-[38%]" />
      <Cloud className="pointer-events-none absolute bottom-[14%] left-[30%] -z-10 hidden w-[9%] md:block" />
      <Cloud className="pointer-events-none absolute right-[30%] bottom-[8%] -z-10 hidden w-[10%] md:block" />
      <Leaves className="pointer-events-none absolute bottom-0 left-[20%] -z-10 w-[26%] md:w-[15%]" />
      <Leaves className="pointer-events-none absolute right-[22%] bottom-0 -z-10 w-[24%] md:w-[13%]" />

      {/* header */}
      <header className="relative grid grid-cols-[1fr_auto] items-center gap-y-3 px-4 pt-5 sm:px-[5%] md:grid-cols-[1fr_auto_1fr]">
        <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-[#A61B2B]" aria-label="Blood Bridge home">
          <HeartCross />
          <span className="font-[family-name:var(--font-display)] text-[15px] leading-[0.95] font-bold tracking-wide text-[#A61B2B] uppercase">
            Blood
            <br />
            Bridge
          </span>
        </Link>
        <nav aria-label="Primary" className="order-3 col-span-2 flex justify-center gap-7 text-[13px] md:order-none md:col-span-1">
          {NAV.map((item) =>
            item.to.startsWith("#") ? (
              <a key={item.label} href={item.to} className="py-1 hover:text-[#A61B2B]">
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                to={item.to}
                aria-current={"active" in item ? "page" : undefined}
                className={"active" in item ? "border-b-2 border-[#A61B2B] py-1 font-medium text-[#A61B2B]" : "py-1 hover:text-[#A61B2B]"}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex flex-col items-end gap-1.5">
          <span className="hidden text-[12px] sm:inline">blood-bridge.workers.dev</span>
          <div className="flex gap-1.5">
            {SOCIALS.map((s) => (
              <a key={s.name} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className="size-[22px] rounded-full transition-transform hover:scale-110">
                <SocialIcon name={s.name} />
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* headline */}
      <div className="relative flex flex-1 flex-col items-center px-6 pt-10 pb-[44vh] text-center md:justify-center md:pt-0 md:pb-[10vh]">
        <p className="font-[family-name:var(--font-display)] text-[clamp(22px,2.5vw,36px)] font-medium tracking-[0.28em] uppercase">Donate</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[clamp(44px,6.4vw,96px)] leading-[1.02] font-extrabold text-[#A61B2B] uppercase">
          Your Blood
        </h1>
        <p className="mt-3 font-[family-name:var(--font-display)] text-[clamp(20px,2.3vw,34px)] font-semibold">
          25 blood banks <span className="mx-1 font-normal">|</span> one live screen
        </p>
        <p className="mt-4 max-w-[34rem] text-[clamp(13px,1.1vw,16px)] leading-relaxed text-[#737373]">
          Find compatible, in-date blood across Mumbai, reserve it in one tap,
          <br className="hidden sm:inline" /> and answer when a nearby bank needs your group.
        </p>
        <Link
          to="/donor?join=1"
          className="mt-6 rounded-full bg-[#A61B2B] px-6 py-2.5 text-[13px] font-semibold tracking-[0.08em] text-white uppercase shadow-[0_6px_16px_-6px_rgb(127_20_34/0.55)] transition-colors hover:bg-[#7F1422] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A61B2B]"
        >
          Book now
        </Link>
        <p className="mt-3 text-[11px] tracking-wide text-[#737373]">Demo uses simulated patients and donors · real Mumbai blood banks</p>
      </div>
    </section>
  );
}
