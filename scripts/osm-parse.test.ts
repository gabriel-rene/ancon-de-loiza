import { expect, test } from 'vitest';
import { parseOsm } from './osm-parse';
import { project } from '../src/geo/project';

const XML = `<?xml version="1.0"?><osm>
<node id="1" lat="18.4340" lon="-65.8830"/><node id="2" lat="18.4340" lon="-65.8810"/>
<node id="3" lat="18.4360" lon="-65.8810"/><node id="4" lat="18.4360" lon="-65.8830"/>
<node id="5" lat="18.4400" lon="-65.8900"/><node id="6" lat="18.4400" lon="-65.8700"/>
<node id="7" lat="18.4000" lon="-65.8000"/><node id="8" lat="18.4001" lon="-65.8000"/>
<way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="natural" v="water"/><tag k="water" v="river"/></way>
<way id="11"><nd ref="5"/><nd ref="6"/><tag k="natural" v="coastline"/></way>
<way id="12"><nd ref="1"/><nd ref="3"/><tag k="highway" v="primary"/><tag k="ref" v="PR-187"/><tag k="bridge" v="yes"/></way>
<way id="13"><nd ref="7"/><nd ref="8"/><tag k="highway" v="track"/></way>
<way id="14"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="natural" v="wetland"/></way>
<way id="15"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="natural" v="water"/><tag k="water" v="wastewater"/></way>
</osm>`;

test('parses water, coastline, land and nearby roads', () => {
  const g = parseOsm(XML, 2000);
  expect(g.water).toHaveLength(1);
  expect(g.water[0].kind).toBe('river');
  expect(g.water[0].ring.length).toBe(4); // closing node dropped
  expect(g.coastline).toHaveLength(1);
  expect(g.land.map((l) => l.kind)).toEqual(['wetland']);
  expect(g.roads).toHaveLength(1); // far track filtered out
  expect(g.roads[0]).toMatchObject({ ref: 'PR-187', bridge: true, kind: 'primary' });
});

const RELATION_XML = `<?xml version="1.0"?><osm>
<node id="1" lat="18.4340" lon="-65.8830"/><node id="2" lat="18.4340" lon="-65.8810"/>
<node id="3" lat="18.4360" lon="-65.8810"/><node id="4" lat="18.4360" lon="-65.8830"/>
<way id="20"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/></way>
<relation id="30">
  <member type="way" ref="20" role="outer"/>
  <member type="way" ref="99" role="outer"/>
  <tag k="type" v="multipolygon"/>
  <tag k="natural" v="wetland"/>
</relation>
</osm>`;

test('emits land from a multipolygon relation, skipping missing members', () => {
  const g = parseOsm(RELATION_XML, 2000);
  expect(g.land).toHaveLength(1);
  expect(g.land[0].kind).toBe('wetland');
  expect(g.land[0].ring.length).toBe(3); // closing node dropped
});

const TOWN_XML = `<?xml version="1.0"?><osm>
<node id="1" lat="18.4340" lon="-65.8820"/><node id="2" lat="18.4340" lon="-65.8819"/>
<node id="3" lat="18.4341" lon="-65.8819"/><node id="4" lat="18.4341" lon="-65.8820"/>
<node id="5" lat="18.4000" lon="-65.8000"/><node id="6" lat="18.4000" lon="-65.7999"/><node id="7" lat="18.4001" lon="-65.7999"/>
<way id="40"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building" v="church"/></way>
<way id="41"><nd ref="5"/><nd ref="6"/><nd ref="7"/><nd ref="5"/><tag k="building" v="yes"/></way>
<way id="42"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="leisure" v="park"/><tag k="name" v="Plaza"/></way>
<way id="43"><nd ref="1"/><nd ref="2"/><tag k="building" v="yes"/></way>
</osm>`;

test('keeps closed building and park outlines inside the town circle only', () => {
  const g = parseOsm(TOWN_XML, 2000, { c: project(18.434, -65.882), r: 350 });
  expect(g.buildings.map((b) => [b.id, b.kind])).toEqual([['40', 'church']]);   // 41 far away, 43 not closed
  expect(g.buildings[0].ring).toHaveLength(4);
  expect(g.parks).toMatchObject([{ id: '42', kind: 'park', name: 'Plaza' }]);
  expect(parseOsm(TOWN_XML, 2000).buildings).toEqual([]);   // no circle, no outlines
});
