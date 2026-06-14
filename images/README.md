# Location photos

Photos are stored locally as `images/{location-id}.jpg` and referenced from `data/locations.json`.

Most images are from [Wikimedia Commons](https://commons.wikimedia.org/) (CUHK campus photography). A few locations currently use a stand-in copy from a related site until unique photos are fetched.

To download the canonical Wikimedia originals (run when rate limits allow):

```bash
python3 scripts/fetch-images.py
```

Then optionally re-optimize large files:

```bash
cd images && for f in *.jpg; do sips -Z 1400 -s format jpeg -s formatOptions 85 "$f" --out "$f"; done
```
