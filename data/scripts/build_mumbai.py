#!/usr/bin/env python3
"""Build cleaned Mumbai datasets from data/raw/ into data/mumbai/.

Inputs (produced by fetch_raw.py and fetch_eraktkosh.py):
  data/raw/datagovin_blood_banks_mumbai_thane.json   data.gov.in Blood Bank Directory (GODL-India)
  data/raw/osm_blood_banks_mumbai.json               OpenStreetMap via Overpass (ODbL)
  data/raw/osm_hospitals_mumbai.json                 OpenStreetMap via Overpass (ODbL)
  data/raw/eraktkosh_mumbai_latest.json              e-RaktKosh live stock rows

Outputs:
  data/mumbai/blood_banks.json
  data/mumbai/hospitals.json
  data/mumbai/stock_snapshot.json
  data/mumbai/_coordinate_check.json  (audit trail: OSM vs data.gov.in distance per bank)

Selection: the curated BANKS table below lists blood banks that (a) appear in the
data.gov.in directory for district MUMBAI, (b) report stock on e-RaktKosh, and (c) have
coordinates inside the Mumbai bbox. The three source records are linked by hand
(names differ between sources, e.g. "Blood Bank" was renamed "Blood Centre" after the
2020 Drugs & Cosmetics amendment); every link was checked against address/phone.

Coordinate rule: use the OSM node when present (it was imported from the same OGD
directory and some nodes were later corrected by mappers, e.g. check_date=2026-03-20);
otherwise data.gov.in. Records > 1 km apart between sources are flagged and the choice
is justified in the `coordNote` of _coordinate_check.json.

Usage: python3 -I data/scripts/build_mumbai.py   (from repo root)
"""
import html
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
OUT = os.path.join(ROOT, "mumbai")
BBOX = (18.85, 19.30, 72.75, 73.05)  # lat min, lat max, lng min, lng max

# id, data.gov.in sr_no, OSM node id (or None), exact e-RaktKosh name, area
BANKS = [
    ("bb-kem-parel", 1396, 6884803661, "K.E.M. Hospital Blood Centre", "Parel"),
    ("bb-tata-memorial-parel", 1423, 6884803659, "TATA MEMORIAL CENTRE- TATA MEMORIAL HOSPITAL", "Parel"),
    ("bb-wadia-parel", 1406, 6884803660, "N.M Wadia Hospital Blood Centre Parel Mumbai", "Parel"),
    ("bb-ltmgh-sion", 1400, 6884803652, "L.T.M.G., Municipal Hospital Blood Centre", "Sion"),
    ("bb-somaiya-sion", 1394, 6884803650, "K.J.Somaiya Medical College And Hospital Blood Centre", "Sion"),
    ("bb-nair-mumbai-central", 1378, 6884803678, "Byl Nair Hospital, Blood Centre", "Mumbai Central"),
    ("bb-jj-byculla", 1420, 6884803675, "Sir, J.J. Group Hospital Blood Centre, Byculla Mumbai", "Byculla"),
    ("bb-saifee-charni-road", 1416, 6884803721, "Saifee Hospital Trust Blood Centre", "Charni Road"),
    ("bb-shushrusha-dadar", 1419, 6881057850, "Shushrusha Citizens Co-Op Hospital Blood Centre", "Dadar"),
    ("bb-hinduja-mahim", 1409, 6884803658, "P.D. Hinduja Hospital And Medical Research, Blood Centre", "Mahim"),
    ("bb-raheja-mahim", 1414, 6884803657, "S. L. Raheja Hospital. Blood Centre, Mahim", "Mahim"),
    ("bb-lilavati-bandra", 1399, None, "Lilavati Hospital And Research Centre Blood Centre", "Bandra (W)"),
    ("bb-holy-family-bandra", 1372, 6884803654, "Bandra Holly Family Hospital Society Blood Centre", "Bandra (W)"),
    ("bb-nanavati-vile-parle", 1395, 6881057809, "Smt. Kapoorben Vasanji Lathiya Blood Centre", "Vile Parle (W)"),
    ("bb-cooper-juhu", 1412, 6881057808, "Dr. R.N.Cooper Hospital Blood Centre Vile Parle (W) Mumbai,", "Juhu / Vile Parle (W)"),
    ("bb-goenka-andheri", 1371, 6881057807, "Rotary D.G Goenka Blood Centre( Municipal Gen. Hospital)", "Andheri (W)"),
    ("bb-holy-spirit-andheri", 1389, 6884803647, "Holy Spirit Hospital Blood Centre", "Andheri (E)"),
    ("bb-sevenhills-marol", 1418, 6884803648, "Sevenhills Healthcare Private Limited Hospital Blood Centre", "Marol, Andheri (E)"),
    ("bb-meenatai-goregaon", 1410, 6884803646, "Meenatai Thackeray Blood Centre, Goregaon, Mumbai, Managed By Prabodhan Goregaon", "Goregaon (W)"),
    ("bb-suburban-malad", 1388, 6880996884, "Suburban Hi-Tech Blood Centre", "Malad (E)"),
    ("bb-rajawadi-ghatkopar", 1413, 6881057813, "Seth V.C.Gandhi And M.A.Vora Municipal General Hospital, Rajawadi ,Ghatkopar", "Ghatkopar (E)"),
    ("bb-anviksha-ghatkopar", 1368, 6881057814, "Deepak Foundations Anviksha Blood Centre", "Ghatkopar (E)"),
    ("bb-hiranandani-powai", 1382, None, "Dr. L. H. Hiranandani Hospital, Blood Centre", "Powai"),
    ("bb-arpan-bhandup", 1407, 6881057817, "Matoshri Valbai Mulji Shah, Arpan Blood Centre", "Bhandup (W)"),
    ("bb-fortis-mulund", 1384, 6881057819, "Fortis  Hospital Blood Centre", "Mulund (W)"),
]

# id, OSM element "type/id", category, area, note
HOSPITALS = [
    ("hsp-sion-ltmgh", "way/49681498", "government", "Sion",
     "Lokmanya Tilak Municipal General Hospital (MCGM); Sion lies in the Mithi/King's Circle flood belt."),
    ("hsp-rajawadi-ghatkopar", "node/14173965274", "government", "Ghatkopar (E)",
     "Seth V.C. Gandhi & M.A. Vora Municipal General (Rajawadi) Hospital."),
    ("hsp-vn-desai-santacruz", "way/1442093565", "government", "Santacruz (E)",
     "V.N. Desai Municipal General Hospital (BMC), near the Mithi river / Kalina."),
    ("hsp-shatabdi-govandi", "way/411617420", "government", "Govandi",
     "Shatabdi Hospital, operated by the Municipal Corporation of Greater Mumbai."),
    ("hsp-hbt-trauma-jogeshwari", "way/554967613", "government", "Jogeshwari (E)",
     "Hindu Hruday Samrat Balasaheb Thackeray Trauma Care Municipal Hospital - a dedicated trauma centre."),
    ("hsp-nair-mumbai-central", "node/7664032237", "government", "Mumbai Central",
     "B.Y.L. Nair Charitable Hospital (MCGM teaching hospital)."),
]

DG_CATEGORY = {"Government": "government", "Private": "private", "Charity": "charitable"}

# e-RaktKosh component code -> Blood Bridge component (see src/shared/domain.ts COMPONENTS)
COMPONENT_MAP = {
    "11": "whole_blood",
    "12": "red_cells", "28": "red_cells", "30": "red_cells", "29": "red_cells",
    "13": "plasma", "19": "plasma", "18": "plasma",
    "23": "platelets", "20": "platelets", "14": "platelets",
    # 16 Platelet Rich Plasma, 17 Cryoprecipitate, 21 Cryo Poor Plasma: excluded (not modelled)
}
GROUP_MAP = {"A+Ve": "A+", "A-Ve": "A-", "B+Ve": "B+", "B-Ve": "B-", "O+Ve": "O+", "O-Ve": "O-",
             "AB+Ve": "AB+", "AB-Ve": "AB-"}  # "Oh+VE"/"Oh-VE" (Bombay phenotype) not modelled


def haversine_m(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def in_bbox(lat, lng):
    return BBOX[0] <= lat <= BBOX[1] and BBOX[2] <= lng <= BBOX[3]


def first_phone(s):
    if not s or s.strip().upper() == "NA":
        return None
    p = re.split(r"[;,]", s)[0].strip()
    p = re.sub(r"\s+", " ", p)
    return p or None


def load(name):
    with open(os.path.join(RAW, name)) as f:
        return json.load(f)


def main():
    os.makedirs(OUT, exist_ok=True)
    dg = {r["sr_no"]: r for r in load("datagovin_blood_banks_mumbai_thane.json")["records"]}
    osm = {e["id"]: e for e in load("osm_blood_banks_mumbai.json")["elements"]}
    osm_h = {f'{e["type"]}/{e["id"]}': e for e in load("osm_hospitals_mumbai.json")["elements"]}
    ek = load("eraktkosh_mumbai_latest.json")

    banks, audit = [], []
    for bid, sr, osm_id, ek_name, area in BANKS:
        r = dg[sr]
        dg_pt = (float(r["_latitude"]), float(r["_longitude"]))
        o = osm.get(osm_id) if osm_id else None
        osm_pt = (o["lat"], o["lon"]) if o else None
        dist = round(haversine_m(dg_pt, osm_pt)) if osm_pt and dg_pt[0] else None
        lat, lng = osm_pt if osm_pt else dg_pt
        if not in_bbox(lat, lng):
            raise SystemExit(f"{bid}: coordinate outside Mumbai bbox: {lat},{lng}")
        audit.append({"id": bid, "datagovin": dg_pt, "osm": osm_pt, "distance_m": dist,
                      "used": "osm" if osm_pt else "datagovin", "flag": bool(dist and dist > 1000)})
        name = html.unescape(re.sub(r"\s+", " ", r["_blood_bank_name"])).strip()
        banks.append({
            "id": bid,
            "name": name,
            "category": DG_CATEGORY.get(r["_category"], "unknown"),
            "address": html.unescape(re.sub(r"\s+", " ", r["_address"])).strip(),
            "area": area,
            "phone": first_phone(r["_contact_no"]),
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "source": "data.gov.in Blood Bank Directory (MoHFW/NIHFW, GODL-India)"
                      + ("; coordinates: OpenStreetMap (ODbL)" if osm_pt else "; coordinates: data.gov.in"),
            "sourceId": f"datagovin:fced6df9-a360-4e08-8ca0-f283fc74ce15#sr_no={sr}"
                        + (f";osm:node/{osm_id}" if osm_id else "") + f";eraktkosh:{ek_name.strip()}",
        })

    hospitals = []
    for hid, key, cat, area, note in HOSPITALS:
        e = osm_h[key]
        t = e["tags"]
        c = e.get("center", e)
        lat, lng = c["lat"], c["lon"]
        assert in_bbox(lat, lng), hid
        addr = t.get("addr:full") or ", ".join(x for x in (t.get("addr:housenumber"), t.get("addr:street"), t.get("addr:city"), t.get("addr:postcode")) if x)
        phone = t.get("phone") or t.get("contact:phone")
        hospitals.append({
            "id": hid, "name": t.get("name"), "category": cat, "address": addr or None, "area": area,
            "phone": phone.split(",")[0].strip() if phone else None,
            "lat": round(lat, 6), "lng": round(lng, 6),
            "source": "OpenStreetMap contributors (ODbL), via Overpass API", "sourceId": f"osm:{key}",
            "note": note,
        })

    # --- e-RaktKosh stock snapshot ---------------------------------------------------
    by_name = {}
    last_updated = {}
    for res in ek["results"]:
        comp = COMPONENT_MAP.get(res["componentCode"])
        for row in res["rows"]:
            nm = row[1].split("<br/>")[0].strip()
            last_updated[nm] = max(last_updated.get(nm, ""), row[4] or "")
            if comp is None:
                continue
            for g, n in re.findall(r"((?:AB|A|B|O)[+-]Ve):(\d+)", row[3]):
                grp = GROUP_MAP[g]
                d = by_name.setdefault(nm, {})
                d.setdefault(grp, {}).setdefault(comp, 0)
                d[grp][comp] += int(n)
    snap_banks, snap_updated = {}, {}
    for bid, _sr, _o, ek_name, _a in BANKS:
        key = ek_name.strip()
        if key not in last_updated:
            raise SystemExit(f"{bid}: e-RaktKosh name not found in snapshot: {key!r}")
        stock = by_name.get(key, {})
        snap_banks[bid] = {g: {c: stock.get(g, {}).get(c, 0) for c in ("whole_blood", "red_cells", "platelets", "plasma")}
                           for g in ("O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+")}
        snap_updated[bid] = last_updated[key]
    snapshot = {
        "fetchedAt": ek["fetchedAt"],
        "source": "e-RaktKosh (MoHFW / NBTC) public Blood Availability endpoint "
                  "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/nearbyBB.cnt?hmode=GETNEARBYSTOCKDETAILS "
                  "(stateCode=27, districtCode=519/518, bloodGroup=all)",
        "unit": "units (bags) reported available by the blood centre",
        "componentMapping": {
            "whole_blood": ["Whole Blood"],
            "red_cells": ["Packed Red Blood Cells", "Sagm Packed Red Blood Cells", "Leukoreduced Rbc", "Irradiated RBC"],
            "platelets": ["Random Donor Platelets", "Platelet Concentrate", "Single Donor Platelet"],
            "plasma": ["Fresh Frozen Plasma", "Plasma", "Single Donor Plasma"],
            "excluded": ["Cryoprecipitate", "Cryo Poor Plasma", "Platelet Rich Plasma", "Oh+/Oh- (Bombay phenotype)"],
        },
        "bankLastUpdatedIST": snap_updated,
        "banks": snap_banks,
    }

    def dump(name, obj):
        with open(os.path.join(OUT, name), "w") as f:
            json.dump(obj, f, indent=2, ensure_ascii=False)
            f.write("\n")

    dump("blood_banks.json", banks)
    dump("hospitals.json", hospitals)
    dump("stock_snapshot.json", snapshot)
    dump("_coordinate_check.json", audit)
    tot = {bid: sum(sum(v.values()) for v in g.values()) for bid, g in snap_banks.items()}
    print(f"banks={len(banks)} hospitals={len(hospitals)} stock_total_units={sum(tot.values())}")
    for a in audit:
        if a["flag"] or a["used"] == "datagovin":
            print("check:", a)
    print("zero-stock banks:", [b for b, t in tot.items() if t == 0])


if __name__ == "__main__":
    main()
