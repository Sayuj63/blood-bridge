/**
 * 3D dressing for the OpenFreeMap base styles: extruded buildings, open terrain relief
 * (AWS Terrain Tiles, hillshade only so deck.gl positions stay on a flat ground plane),
 * directional light and a sky/fog gradient. Everything is open data, no keys.
 */
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ThemeName } from "../../styles/tokens";

interface Palette {
  buildingLow: string;
  buildingHigh: string;
  buildingOpacity: number;
  shadow: string;
  highlight: string;
  accent: string;
  sky: string;
  horizon: string;
  fog: string;
  light: string;
  lightIntensity: number;
}

const PALETTE: Record<ThemeName, Palette> = {
  command: {
    buildingLow: "#142130",
    buildingHigh: "#2d4560",
    buildingOpacity: 0.9,
    shadow: "#02070d",
    highlight: "#2a3b4f",
    accent: "#0b1622",
    sky: "#030a12",
    horizon: "#16324a",
    fog: "#0a1826",
    light: "#b9d4ff",
    lightIntensity: 0.32,
  },
  analytics: {
    buildingLow: "#efebe8",
    buildingHigh: "#dcd5d0",
    buildingOpacity: 0.9,
    shadow: "#cfc7c2",
    highlight: "#ffffff",
    accent: "#e6dfda",
    sky: "#fcebed",
    horizon: "#faf9f6",
    fog: "#faf9f6",
    light: "#ffffff",
    lightIntensity: 0.38,
  },
  clinical: {
    buildingLow: "#e4e8ed",
    buildingHigh: "#c3ccd7",
    buildingOpacity: 0.92,
    shadow: "#9aa6b4",
    highlight: "#ffffff",
    accent: "#c9d1db",
    sky: "#cfe0f1",
    horizon: "#f4f7fa",
    fog: "#eef2f6",
    light: "#ffffff",
    lightIntensity: 0.4,
  },
};

const TERRAIN_SOURCE = "bb-terrain";

/** First symbol layer, so extrusions sit under the labels. */
function firstSymbolId(map: MapLibreMap): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
}

export function apply3dStyle(map: MapLibreMap, theme: ThemeName, opts: { buildings: boolean; relief: boolean }): void {
  const p = PALETTE[theme];
  const before = firstSymbolId(map);

  if (opts.relief && !map.getSource(TERRAIN_SOURCE)) {
    map.addSource(TERRAIN_SOURCE, {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 13,
      attribution: "Terrain: Mapzen / AWS Open Data",
    });
    // Insert right above the land/water fills so roads draw over the relief.
    const anchor = map.getLayer("waterway") ? "waterway" : before;
    map.addLayer(
      {
        id: "bb-hillshade",
        type: "hillshade",
        source: TERRAIN_SOURCE,
        paint: {
          "hillshade-exaggeration": theme === "command" ? 0.55 : 0.35,
          "hillshade-shadow-color": p.shadow,
          "hillshade-highlight-color": p.highlight,
          "hillshade-accent-color": p.accent,
          "hillshade-illumination-direction": 315,
        },
      },
      anchor,
    );
  }

  if (opts.buildings && map.getSource("openmaptiles") && !map.getLayer("bb-buildings-3d")) {
    map.addLayer(
      {
        id: "bb-buildings-3d",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "render_height"], 8],
            0,
            p.buildingLow,
            60,
            p.buildingHigh,
          ],
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            0,
            13.6,
            ["coalesce", ["get", "render_height"], 8],
          ],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": p.buildingOpacity,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      before,
    );
  }

  map.setLight({ anchor: "viewport", color: p.light, intensity: p.lightIntensity, position: [1.4, 210, 35] });
  map.setSky({
    "sky-color": p.sky,
    "horizon-color": p.horizon,
    "fog-color": p.fog,
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.5,
    "fog-ground-blend": 0.35,
    "atmosphere-blend": 0,
  });
}
