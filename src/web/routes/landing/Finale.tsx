import { Play } from "lucide-react";
import { Link } from "react-router";
import { HeartCross } from "./hero/art";

const CREDITS: { name: string; url: string; role: string }[] = [
  { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", role: "map data and coordinates (ODbL)" },
  { name: "data.gov.in", url: "https://data.gov.in", role: "blood bank directory (GODL-India)" },
  { name: "e-RaktKosh", url: "https://eraktkosh.mohfw.gov.in", role: "public stock data" },
  { name: "OpenFreeMap", url: "https://openfreemap.org", role: "vector tiles" },
  { name: "MapLibre", url: "https://maplibre.org", role: "map rendering" },
  { name: "deck.gl", url: "https://deck.gl", role: "transfer arcs" },
  { name: "Natural Earth", url: "https://www.naturalearthdata.com", role: "world map (public domain)" },
  { name: "Workers AI", url: "https://developers.cloudflare.com/workers-ai/", role: "open-model situation briefs" },
];

/** (g) The call to action in a red panel, then a one-line credits strip. */
export function Finale() {
  return (
    <>
      <section aria-labelledby="cta-title" className="px-4 py-20 sm:px-8 sm:py-28">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-accent px-6 py-16 text-center text-accent-ink sm:px-12 sm:py-24">
          {/* soft drops in the corners */}
          <svg viewBox="0 0 12 16" className="absolute -top-6 -left-4 h-40 w-32 text-accent-hover opacity-60" aria-hidden="true">
            <path d="M6 0.5 C6 0.5 0.8 6.6 0.8 10.2 A5.2 5.2 0 0 0 11.2 10.2 C11.2 6.6 6 0.5 6 0.5 Z" fill="currentColor" />
          </svg>
          <svg viewBox="0 0 12 16" className="absolute -right-6 -bottom-10 h-56 w-44 text-accent-hover opacity-60" aria-hidden="true">
            <path d="M6 0.5 C6 0.5 0.8 6.6 0.8 10.2 A5.2 5.2 0 0 0 11.2 10.2 C11.2 6.6 6 0.5 6 0.5 Z" fill="currentColor" />
          </svg>
          <h2 id="cta-title" className="relative mx-auto max-w-3xl font-display text-[clamp(2rem,1rem+4vw,4.4rem)] leading-[1] font-bold text-balance">
            Watch a flood hit Kurla, and the city answer.
          </h2>
          <p className="relative mx-auto mt-5 max-w-lg text-lg text-white/80">Hospital, blood bank and a donor's phone. Sixty seconds, live.</p>
          <div className="relative mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/stage"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-accent transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Play className="size-4" aria-hidden /> Start the live demo
            </Link>
            <Link
              to="/command"
              className="inline-flex items-center rounded-full border border-white/60 px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Open command
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <HeartCross size={22} />
            <span>Team Straw Hats · MindSprint 2026</span>
          </div>
          <ul className="flex flex-wrap items-center gap-1.5" aria-label="Open data and open source used">
            <li className="mr-1 text-xs text-ink-faint">Built on</li>
            {CREDITS.map((c) => (
              <li key={c.name}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  title={c.role}
                  className="block rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
}
