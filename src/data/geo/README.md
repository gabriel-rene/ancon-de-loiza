# Geography data

`loiza.json` is derived from **OpenStreetMap** data, © OpenStreetMap contributors,
and is made available under the **Open Database License (ODbL) 1.0**:
https://opendatacommons.org/licenses/odbl/ (attribution: https://www.openstreetmap.org/copyright).

- Source: OSM API 0.6 `map` call, bounding box `-65.900,18.420,-65.865,18.450`
  (minLon, minLat, maxLon, maxLat) around the Río Grande de Loíza crossing.
- Extracted: 2026-09-26, by `scripts/bake-osm.ts` (`npm run bake`), which keeps the river and
  pond polygons, coastline, land cover and roads and projects them to local metres
  (origin 18.43485 N, 65.8823 W).
- The app displays the required attribution ("Map data © OpenStreetMap contributors") on screen.

`loiza.json` is a Derivative Database under the ODbL; if you redistribute or adapt it, keep it
under the ODbL and keep the attribution. Everything else in this repository (code, other data,
docs) is MIT-licensed — see the root [LICENSE](../../../LICENSE).
