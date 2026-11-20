import { Play } from "lucide-react";
import { LinkButton } from "../../components/ui/Button";
import { Logo } from "../../brand/Logo";

const CREDITS: { name: string; url: string; role: string }[] = [
  { name: "OpenStreetMap", url: "https://www.openstreetmap.org/copyright", role: "map data and coordinates (ODbL)" },
  { name: "data.gov.in", url: "https://data.gov.in", role: "blood bank directory (GODL-India)" },
  { name: "e-RaktKosh", url: "https://eraktkosh.mohfw.gov.in", role: "public stock snapshot" },
  { name: "OpenFreeMap", url: "https://openfreemap.org", role: "vector tiles" },
  { name: "MapLibre", url: "https://maplibre.org", role: "map rendering" },
  { name: "deck.gl", url: "https://deck.gl", role: "transfer arcs" },
  { name: "Cloudflare Workers AI", url: "https://developers.cloudflare.com/workers-ai/", role: "open-model situation briefs" },
];

/** (g) The call to action, then a small credits strip. */
export function Finale() {
  return (
    <>
      <section aria-labelledby="cta-title" className="relative overflow-hidden border-t border-line">
        <div className="mx-auto max-w-7xl px-4 py-28 text-center sm:px-8 sm:py-36">
          <h2 id="cta-title" className="mx-auto max-w-4xl font-display text-[clamp(2.2rem,1rem+4.5vw,5rem)] leading-[0.98] text-balance">
            Watch a flood hit Kurla, and the city answer.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-muted">
            The hospital, the blood bank and a donor's phone, side by side. Sixty seconds, live.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <LinkButton to="/stage" variant="primary" size="xl" icon={<Play className="size-5" aria-hidden />}>
              Start the live demo
            </LinkButton>
            <LinkButton to="/command" variant="secondary" size="xl">
              Open command
            </LinkButton>
          </div>
        </div>
      </section>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-ink-faint sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Logo size={20} />
            <span>Team Straw Hats · MindSprint 2026</span>
          </div>
          <p className="max-w-4xl">
            Built entirely on open data and open source:{" "}
            {CREDITS.map((c, i) => (
              <span key={c.name}>
                <a href={c.url} target="_blank" rel="noreferrer" className="text-ink-muted underline-offset-2 hover:underline">
                  {c.name}
                </a>{" "}
                ({c.role}){i < CREDITS.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
        </div>
      </footer>
    </>
  );
}
