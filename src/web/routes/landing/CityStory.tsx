import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { haversineKm } from "../../../shared/geo";
import { SURGE_PRESETS } from "../../../shared/forecast";
import { CityMap, type MapArc, type MapMarker } from "../../components/map/CityMap";
import { formatISTDateTime } from "../../lib/format";
import type { GeoPoint } from "../../../shared/domain";
import { KURLA, PARADOX, SNAPSHOT_AT, SNAPSHOT_FACTS, STORY_BANKS, type StoryBank } from "./data";

type Chapter = "paradox" | "doomsday" | "answer";

interface Step {
  id: string;
  chapter: Chapter;
  title: string;
  body: ReactNode;
  camera: { center: GeoPoint; zoom: number; pitch: number };
  /** Surge radius in km, 0 for none. */
  surgeKm: number;
}

const CITY = { center: { lat: 19.075, lng: 72.87 }, zoom: 10.6, pitch: 0 };
const FLOOD = { center: KURLA, zoom: 11.6, pitch: 0 };
const ANSWER = { center: { lat: 19.06, lng: 72.865 }, zoom: 11.2, pitch: 42 };
const floodMax = SURGE_PRESETS.flood.radiusKm;
const oNegMultiplier = SURGE_PRESETS.flood.multipliers["O-|red_cells"];

const STEPS: Step[] = [
  {
    id: "registers",
    chapter: "paradox",
    title: `${SNAPSHOT_FACTS.centres} blood centres. ${SNAPSHOT_FACTS.centres} separate registers.`,
    body: "Each dot is a real Mumbai blood centre. Each one knows its own shelves, and only its own.",
    camera: CITY,
    surgeKm: 0,
  },
  ...(PARADOX
    ? [
        {
          id: "full",
          chapter: "paradox" as const,
          title: "One shelf is full.",
          body: (
            <>
              {PARADOX.full.name} reported {PARADOX.fullUnits} {PARADOX.group} platelet units. Platelets keep for days, not
              weeks. Units nobody asks for are thrown away.
            </>
          ),
          camera: { center: PARADOX.full, zoom: 12.2, pitch: 0 },
          surgeKm: 0,
        },
        {
          id: "dry",
          chapter: "paradox" as const,
          title: "The next one is empty.",
          body: (
            <>
              {PARADOX.dry.name}, {PARADOX.km} km away, reported {PARADOX.dryUnits === 0 ? "none" : PARADOX.dryUnits}. Neither
              can see the other.
            </>
          ),
          camera: { center: midpoint(PARADOX.full, PARADOX.dry), zoom: 12, pitch: 0 },
          surgeKm: 0,
        },
      ]
    : []),
  {
    id: "oneg",
    chapter: "paradox",
    title: "And the rarest group is the hardest to find.",
    body: `${SNAPSHOT_FACTS.zeroONegPlatelets.length} of ${SNAPSHOT_FACTS.centres} centres reported no O-negative platelets in the e-RaktKosh snapshot of ${formatISTDateTime(SNAPSHOT_AT)}.`,
    camera: CITY,
    surgeKm: 0,
  },
  {
    id: "flood-1",
    chapter: "doomsday",
    title: "Then the Mithi overflows at Kurla.",
    body: "Monsoon flooding cuts roads and fills emergency rooms in the eastern suburbs.",
    camera: FLOOD,
    surgeKm: floodMax / 3,
  },
  {
    id: "flood-2",
    chapter: "doomsday",
    title: "Demand spikes inside the water line.",
    body: `In our demo scenario, demand for O-negative red cells near the flood rises ${oNegMultiplier}×. That multiplier is an illustrative assumption, not a measurement.`,
    camera: FLOOD,
    surgeKm: (floodMax * 2) / 3,
  },
  {
    id: "flood-3",
    chapter: "doomsday",
    title: "Every bank's phone rings at once.",
    body: "Shelves inside the zone run down in hours. Nobody has the city-wide picture needed to decide what moves where.",
    camera: { ...FLOOD, zoom: 11.2 },
    surgeKm: floodMax,
  },
  {
    id: "answer",
    chapter: "answer",
    title: "Blood Bridge puts the whole city on one screen.",
    body: "Compatible, in-date units across every bank, ranked by distance and freshness. Reserve in one tap. Blood that would expire unused moves to where it is about to run out, before it does.",
    camera: ANSWER,
    surgeKm: floodMax,
  },
];

/**
 * (c)–(e) A pinned map that changes state as the story scrolls past:
 * the paradox, the flood turning the city red zone by zone, then the bridge.
 */
export function CityStory() {
  const reduced = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const step = STEPS[active];
  const markers = useMemo(() => markersFor(step), [step]);
  const arcs = useMemo(() => (step.chapter === "answer" ? rescueArcs(step.surgeKm) : []), [step]);

  return (
    <section aria-label="What goes wrong, and what changes" className="relative">
      <div className="sticky top-0 h-dvh">
        <CityMap
          theme="clinical"
          interactive={false}
          markers={markers}
          arcs={arcs}
          surge={step.surgeKm > 0 ? { ...KURLA, radiusKm: step.surgeKm } : null}
          center={step.camera.center}
          zoom={step.camera.zoom}
          pitch={reduced ? 0 : step.camera.pitch}
          label="Map of Mumbai blood centres, changing with the story"
          className="h-full w-full"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-canvas/85 via-canvas/20 to-transparent max-lg:bg-gradient-to-t max-lg:from-canvas/90 max-lg:via-canvas/10" />
        <ChapterRail active={step.chapter} />
      </div>

      <div className="relative -mt-[100dvh]">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            ref={(el) => {
              stepRefs.current[i] = el;
            }}
            data-index={i}
            className="flex min-h-dvh items-end px-4 pb-16 sm:px-8 lg:items-center lg:pb-0"
          >
            <motion.article
              initial={reduced ? false : { opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ amount: 0.6 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md rounded-(--radius-panel) border border-line bg-surface/90 p-5 shadow-panel backdrop-blur sm:p-6 lg:ml-[max(2rem,calc((100vw-80rem)/2))]"
            >
              <p className={chapterTone(s.chapter)}>{CHAPTER_LABEL[s.chapter]}</p>
              <h3 className="mt-2 font-display text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)] leading-[1.05]">{s.title}</h3>
              <p className="mt-3 text-base text-ink-muted">{s.body}</p>
            </motion.article>
          </div>
        ))}
      </div>
    </section>
  );
}

const CHAPTER_LABEL: Record<Chapter, string> = {
  paradox: "The paradox",
  doomsday: "Doomsday scenario",
  answer: "The answer",
};

const chapterTone = (c: Chapter) =>
  `font-label text-sm ${c === "doomsday" ? "text-accent" : c === "answer" ? "text-ink" : "text-accent-hover"}`;

function ChapterRail({ active }: { active: Chapter }) {
  const chapters: Chapter[] = ["paradox", "doomsday", "answer"];
  return (
    <ol aria-hidden className="absolute top-1/2 right-4 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
      {chapters.map((c) => (
        <li key={c} className="flex items-center justify-end gap-2 font-label text-xs">
          <span className={c === active ? "text-ink" : "text-ink-faint"}>{CHAPTER_LABEL[c]}</span>
          <span
            className={`h-6 w-1 rounded-full transition-colors duration-500 ${c === active ? (c === "doomsday" ? "bg-accent" : c === "answer" ? "bg-ink" : "bg-accent-hover") : "bg-line-strong"}`}
          />
        </li>
      ))}
    </ol>
  );
}

function midpoint(a: GeoPoint, b: GeoPoint): GeoPoint {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

const inZone = (b: StoryBank, km: number) => km > 0 && haversineKm(KURLA, b) <= km;

/** Brand palette for the story map: red = blood on the shelf / danger, ink = empty, dark red = flood zone. */
const STORY_COLOR = { blood: "#A61B2B", empty: "#171717", zone: "#7F1422", other: "#737373" } as const;

function markersFor(step: Step): MapMarker[] {
  const zeroONeg = new Set(SNAPSHOT_FACTS.zeroONegPlatelets);
  return STORY_BANKS.map((b) => {
    const base: MapMarker = { id: b.key, lat: b.lat, lng: b.lng, label: `${b.name}, ${b.area}`, color: STORY_COLOR.other, size: "md" };
    switch (step.id) {
      case "full":
      case "dry":
        if (PARADOX && b.key === PARADOX.full.key) return { ...base, color: STORY_COLOR.blood, pulse: true, highlighted: true, size: "lg" };
        if (PARADOX && b.key === PARADOX.dry.key && step.id === "dry")
          return { ...base, color: STORY_COLOR.empty, pulse: true, highlighted: true, size: "lg" };
        return { ...base, size: "sm" };
      case "oneg":
        return zeroONeg.has(b.key) ? { ...base, color: STORY_COLOR.empty } : { ...base, color: STORY_COLOR.blood, size: "lg", pulse: true };
      case "answer":
        return inZone(b, step.surgeKm) ? { ...base, color: STORY_COLOR.zone, size: "lg" } : { ...base, color: STORY_COLOR.blood };
      default:
        if (step.chapter === "doomsday") {
          return inZone(b, step.surgeKm) ? { ...base, color: STORY_COLOR.blood, pulse: true, size: "lg" } : { ...base, size: "sm" };
        }
        return base;
    }
  });
}

/** Illustrative rescue arcs: from the nearest banks outside the flood zone to each bank inside it. */
function rescueArcs(zoneKm: number): MapArc[] {
  const inside = STORY_BANKS.filter((b) => inZone(b, zoneKm));
  const outside = STORY_BANKS.filter((b) => !inZone(b, zoneKm));
  return inside.flatMap((to) =>
    [...outside]
      .sort((a, b) => haversineKm(a, to) - haversineKm(b, to))
      .slice(0, 1)
      .map((from) => ({ id: `${from.key}>${to.key}`, from, to, state: "active" as const, color: STORY_COLOR.blood })),
  );
}
