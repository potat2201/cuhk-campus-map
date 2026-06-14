# CUHK Campus Map

An interactive web map of The Chinese University of Hong Kong (香港中文大學) campus, built with [Leaflet](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/).

## Features

- Curated signature locations (landmarks, key buildings, colleges)
- Color-coded teardrop markers by category
- Popups with Chinese/English names, descriptions, and links
- Filter panel to show/hide category groups
- Map / Satellite layer toggle

## Live demo

[https://potat2201.github.io/cuhk-campus-map/](https://potat2201.github.io/cuhk-campus-map/)

Hosted via GitHub Pages from the `main` branch.

## Run locally

The app loads location data via `fetch`, so use a static file server:

```bash
python3 -m http.server 5176 --bind 0.0.0.0
```

Open in your browser:

- Local: [http://localhost:5176](http://localhost:5176)
- Network: [http://192.168.1.89:5176](http://192.168.1.89:5176)

## Project structure

```
index.html          # Main page
css/styles.css      # Styles
js/app.js           # Map logic
data/locations.json # Location dataset
```

## Adding locations

Edit `data/locations.json` and add entries with:

- `id`, `nameZh`, `nameEn`, `lat`, `lng`
- `category`: `landmark`, `building`, or `college`
- `descriptionZh`, `descriptionEn`, `url`

Coordinates can be sourced from the [CUHK Campus Map Data](https://gist.github.com/seventhmoon/8234c5bbde540c2c33da) gist.
