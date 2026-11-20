#!/usr/bin/env python3
"""Download raw source data for Blood Bridge (Mumbai) into data/raw/.

Sources:
  1. data.gov.in "Blood Bank Directory (updated till last month)" (MoHFW / NIHFW),
     resource fced6df9-a360-4e08-8ca0-f283fc74ce15, licence GODL-India.
     Uses the public sample API key published by data.gov.in (10 rows/page),
     filtered to Maharashtra districts MUMBAI, MUMBAI SUBURBAN, THANE.
  2. OpenStreetMap via Overpass API (ODbL): blood banks and hospitals inside the
     Mumbai bbox 18.85-19.30 N, 72.75-73.05 E.

Usage:  python3 -I data/scripts/fetch_raw.py      (run from repo root)
Override the key with env DATA_GOV_IN_KEY if the sample key is rate limited.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
UA = "BloodBridge-hackathon-research/0.1 (MindSprint 2026)"
SAMPLE_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"
RESOURCE = "fced6df9-a360-4e08-8ca0-f283fc74ce15"
BBOX = "18.85,72.75,19.30,73.05"


def get(url, data=None, timeout=120):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def fetch_datagov():
    key = os.environ.get("DATA_GOV_IN_KEY", SAMPLE_KEY)
    out = []
    for district in ("MUMBAI", "MUMBAI SUBURBAN", "THANE"):
        offset = 0
        while True:
            q = urllib.parse.urlencode({
                "api-key": key, "format": "json", "limit": 10, "offset": offset,
                "filters[_state]": "Maharashtra", "filters[_district]": district,
            })
            d = json.loads(get(f"https://api.data.gov.in/resource/{RESOURCE}?{q}"))
            recs = d.get("records", [])
            out.extend(recs)
            offset += len(recs)
            if not recs or offset >= int(d.get("total", 0)):
                break
            time.sleep(0.5)
        print(f"data.gov.in {district}: {offset} records", file=sys.stderr)
    meta = {"resource": RESOURCE, "title": "Blood Bank Directory (updated till last month)",
            "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "records": out}
    with open(os.path.join(RAW, "datagovin_blood_banks_mumbai_thane.json"), "w") as f:
        json.dump(meta, f, indent=1, ensure_ascii=False)


def overpass(query, name):
    body = urllib.parse.urlencode({"data": query}).encode()
    raw = get("https://overpass-api.de/api/interpreter", data=body, timeout=180)
    json.loads(raw)  # validate
    with open(os.path.join(RAW, name), "wb") as f:
        f.write(raw)
    print(f"overpass -> {name}", file=sys.stderr)


def main():
    os.makedirs(RAW, exist_ok=True)
    fetch_datagov()
    overpass(
        f'[out:json][timeout:90];('
        f'nwr["healthcare"="blood_bank"]({BBOX});nwr["healthcare"="blood_donation"]({BBOX});'
        f'nwr["amenity"="blood_bank"]({BBOX});'
        f'nwr["name"~"[Bb]lood [Bb]ank|[Bb]lood [Cc]entre|[Bb]lood [Cc]enter"]({BBOX}););out center tags;',
        "osm_blood_banks_mumbai.json")
    overpass(
        f'[out:json][timeout:90];nwr["amenity"="hospital"]["name"]({BBOX});out center tags;',
        "osm_hospitals_mumbai.json")


if __name__ == "__main__":
    main()
