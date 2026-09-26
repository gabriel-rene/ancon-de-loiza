import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseOsm } from './osm-parse.ts';

const BBOX = '-65.900,18.420,-65.865,18.450'; // minLon,minLat,maxLon,maxLat (OSM API limit: 0.25 deg², 50k nodes)
const CACHE = new URL('./.cache/osm.xml', import.meta.url);
const OUT = new URL('../src/data/geo/loiza.json', import.meta.url);

if (!existsSync(CACHE)) {
  await mkdir(new URL('./.cache/', import.meta.url), { recursive: true });
  const res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${BBOX}`, {
    headers: { 'User-Agent': 'ancon-de-loiza/0.1 (+https://github.com/gabriel-rene/ancon-de-loiza)' },
  });
  if (!res.ok) throw new Error(`OSM API ${res.status}`);
  await writeFile(CACHE, await res.text());
}
const geo = parseOsm(await readFile(CACHE, 'utf8'), 1600);
await writeFile(OUT, JSON.stringify(geo));
console.log(`water ${geo.water.length} · land ${geo.land.length} · coast ${geo.coastline.length} · roads ${geo.roads.length}`);
