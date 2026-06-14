#!/usr/bin/env python3
"""Download location photos from Wikimedia Commons into images/.

Run when Wikimedia rate limits have cleared (one file every ~15s).
Usage: python3 scripts/fetch-images.py
"""

import json
import os
import subprocess
import time
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCATIONS = os.path.join(ROOT, "data", "locations.json")
IMG_DIR = os.path.join(ROOT, "images")

# Direct full-size Commons URLs (not /thumb/ — those are blocked for hotlinking)
SOURCES = {
    "pavilion-of-harmony": "https://upload.wikimedia.org/wikipedia/commons/5/5f/Pavilion_of_Harmony_201607.jpg",
    "pi-chiu-building": "https://upload.wikimedia.org/wikipedia/commons/3/36/CUHK_05-06-2018%282%29.jpg",
    "lake-ad-excellentiam": "https://upload.wikimedia.org/wikipedia/commons/4/4e/Lake_Ad_Excellentiam_tree_view_201602.jpg",
    "main-entrance": "https://upload.wikimedia.org/wikipedia/commons/8/8b/Cuhk_sign_bldg.JPG",
    "gate-of-wisdom": "https://upload.wikimedia.org/wikipedia/commons/0/07/CUHK_GateOfWisdom.JPG",
    "the-beacon": "https://upload.wikimedia.org/wikipedia/commons/9/90/CUHK_05-06-2018%289%29.jpg",
    "university-mall": "https://upload.wikimedia.org/wikipedia/commons/7/7b/CUHK_University_Mall_20221024.jpg",
    "cultural-square": "https://upload.wikimedia.org/wikipedia/commons/3/3a/Gfp-china-hong-kong-landscape-at-cuhk.jpg",
    "philosophy-path": "https://upload.wikimedia.org/wikipedia/commons/3/3f/Gfp-china-hong-kong-walkway-at-cuhk.jpg",
    "confucius-statue": "https://upload.wikimedia.org/wikipedia/commons/0/03/2023%E5%B9%B48%E6%9C%88-%E6%96%B0%E4%BA%9E%E6%9B%B8%E9%99%A2.jpg",
    "clock-tower": "https://upload.wikimedia.org/wikipedia/commons/f/fc/CUHK_05-06-2018%283%29.jpg",
    "new-asia-concourse": "https://upload.wikimedia.org/wikipedia/commons/8/83/CUHK_05-06-2018%284%29.jpg",
    "university-library": "https://upload.wikimedia.org/wikipedia/commons/a/a2/CUHK_UniversityLibrary.JPG",
    "sir-run-run-shaw-hall": "https://upload.wikimedia.org/wikipedia/commons/8/88/Sir_Run_Run_Shaw_Hall.jpg",
    "art-museum": "https://upload.wikimedia.org/wikipedia/commons/0/03/Art_Museum_The_Chinese_University_of_Hong_Kong_201607.jpg",
    "chung-chi-college": "https://upload.wikimedia.org/wikipedia/commons/4/4d/CUHK_ChungChiTong.JPG",
    "new-asia-college": "https://upload.wikimedia.org/wikipedia/commons/0/03/2023%E5%B9%B48%E6%9C%88-%E6%96%B0%E4%BA%9E%E6%9B%B8%E9%99%A2.jpg",
    "united-college": "https://upload.wikimedia.org/wikipedia/commons/8/8c/CUHK_United_College_20190214.jpg",
}


def is_valid_jpeg(path: str) -> bool:
    if not os.path.exists(path) or os.path.getsize(path) < 5000:
        return False
    with open(path, "rb") as f:
        return f.read(2) == b"\xff\xd8"


def main():
    os.makedirs(IMG_DIR, exist_ok=True)
    for id_, url in SOURCES.items():
        out = os.path.join(IMG_DIR, id_ + ".jpg")
        if is_valid_jpeg(out):
            print(f"skip {id_} (already valid)")
            continue
        print(f"fetching {id_}...")
        time.sleep(15)
        subprocess.run(
            [
                "curl",
                "-sL",
                "-A",
                "Mozilla/5.0 (compatible; CUHKMap/1.0)",
                "-H",
                "Referer: https://commons.wikimedia.org/",
                "-o",
                out,
                url,
            ],
            check=False,
        )
        status = "OK" if is_valid_jpeg(out) else "FAILED"
        print(f"  {status} ({os.path.getsize(out)} bytes)")

    with open(LOCATIONS, encoding="utf-8") as f:
        locations = json.load(f)
    for loc in locations:
        loc["image"] = f"images/{loc['id']}.jpg"
    with open(LOCATIONS, "w", encoding="utf-8") as f:
        json.dump(locations, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Updated data/locations.json with local image paths.")


if __name__ == "__main__":
    main()
