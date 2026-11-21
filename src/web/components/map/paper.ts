import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * "Paper" look: repaints the OpenFreeMap Positron base in the landing palette, so the city reads
 * like part of the hero illustration — warm off-white land, blush water, white roads, soft labels.
 */
const PAPER = {
  land: "#FAF9F6",
  water: "#FCEBED",
  waterLine: "#F6D9DD",
  park: "#FFF5F5",
  building: "#EAE6E3",
  road: "#FFFFFF",
  casing: "#EAE6E3",
  rail: "#EAE6E3",
  label: "#737373",
  labelStrong: "#171717",
  halo: "#FAF9F6",
} as const;

type PaintProp = Parameters<MapLibreMap["setPaintProperty"]>[1];

function paint(map: MapLibreMap, id: string, prop: PaintProp, value: string | number) {
  try {
    map.setPaintProperty(id, prop, value);
  } catch {
    // Layer or property absent in this style version — skip it.
  }
}

export function applyPaperLook(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers ?? []) {
    const { id, type } = layer;
    if (type === "background") paint(map, id, "background-color", PAPER.land);
    else if (type === "fill") {
      if (/water/.test(id)) paint(map, id, "fill-color", PAPER.water);
      else if (/park|wood|landcover|grass/.test(id)) paint(map, id, "fill-color", PAPER.park);
      else if (/building/.test(id)) paint(map, id, "fill-color", PAPER.building);
      else paint(map, id, "fill-color", PAPER.land);
      if (/residential/.test(id)) paint(map, id, "fill-opacity", 0.4);
    } else if (type === "line") {
      if (/waterway/.test(id)) paint(map, id, "line-color", PAPER.waterLine);
      else if (/casing/.test(id)) paint(map, id, "line-color", PAPER.casing);
      else if (/rail/.test(id)) paint(map, id, "line-color", PAPER.rail);
      else if (/boundary/.test(id)) paint(map, id, "line-color", PAPER.casing);
      // Uncased minor roads would vanish white-on-paper, so they are drawn in the soft grey.
      else if (/minor|path|pier|taxiway/.test(id)) paint(map, id, "line-color", PAPER.casing);
      else paint(map, id, "line-color", PAPER.road);
    } else if (type === "symbol") {
      paint(map, id, "text-color", /city|town|country|state/.test(id) ? PAPER.labelStrong : PAPER.label);
      paint(map, id, "text-halo-color", PAPER.halo);
    }
  }
}
