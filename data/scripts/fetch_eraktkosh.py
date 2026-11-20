#!/usr/bin/env python3
"""Fetch a live blood-stock snapshot for Mumbai from e-RaktKosh (MoHFW / NBTC).

e-RaktKosh's public "Blood Availability" page
(https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt) calls an
unauthenticated JSON endpoint:

  /BLDAHIMS/bloodbank/nearbyBB.cnt?hmode=GETNEARBYSTOCKDETAILS
      &stateCode=27 (Maharashtra) &districtCode=519 (Mumbai) | 518 (Mumbai Suburban)
      &bloodGroup=all &bloodComponent=<code> &lang=0

Each row: [srNo, "name<br/>address<br/>Phone..", category, availabilityHtml,
           lastUpdated "YYYY-MM-DD HH:MM:SS" (IST), type]

Writes data/raw/eraktkosh_mumbai_<UTC timestamp>.json (raw rows per district x component)
and data/raw/eraktkosh_mumbai_latest.json (same content).

Usage: python3 -I data/scripts/fetch_eraktkosh.py
"""
import json
import os
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
BASE = "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/nearbyBB.cnt"
UA = "Mozilla/5.0 (BloodBridge-hackathon-research/0.1; MindSprint 2026)"

DISTRICTS = {"519": "Mumbai", "518": "Mumbai Suburban"}
# Component codes as listed in the <select> on stockAvailability.cnt
COMPONENTS = {
    "11": "Whole Blood",
    "12": "Packed Red Blood Cells",
    "28": "Sagm Packed Red Blood Cells",
    "30": "Leukoreduced Rbc",
    "29": "Irradiated RBC",
    "13": "Fresh Frozen Plasma",
    "19": "Plasma",
    "18": "Single Donor Plasma",
    "21": "Cryo Poor Plasma",
    "17": "Cryoprecipitate",
    "23": "Random Donor Platelets",
    "20": "Platelet Concentrate",
    "14": "Single Donor Platelet",
    "16": "Platelet Rich Plasma",
}


def fetch(dc, comp):
    q = urllib.parse.urlencode({
        "hmode": "GETNEARBYSTOCKDETAILS", "stateCode": "27", "districtCode": dc,
        "bloodGroup": "all", "bloodComponent": comp, "lang": "0",
    })
    req = urllib.request.Request(f"{BASE}?{q}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read()).get("data", [])


def main():
    fetched_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    out = {"fetchedAt": fetched_at, "endpoint": BASE, "stateCode": "27", "results": []}
    for dc, dname in DISTRICTS.items():
        for comp, cname in COMPONENTS.items():
            rows = fetch(dc, comp)
            out["results"].append({"districtCode": dc, "district": dname,
                                   "componentCode": comp, "component": cname, "rows": rows})
            time.sleep(0.4)
    stamp = fetched_at.replace(":", "").replace("-", "")
    for name in (f"eraktkosh_mumbai_{stamp}.json", "eraktkosh_mumbai_latest.json"):
        with open(os.path.join(RAW, name), "w") as f:
            json.dump(out, f, indent=1, ensure_ascii=False)
    print("saved", fetched_at, sum(len(r["rows"]) for r in out["results"]), "rows")


if __name__ == "__main__":
    main()
