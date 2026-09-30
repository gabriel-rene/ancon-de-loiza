import * as THREE from 'three';
import type { QualitySettings } from '../quality';
import { frigate, pelicanFisher, pelicanFlock } from './flyers';
import { buildFaunaShape, type Shape } from './geometry';
import { faunaMaterials, ringMaterial } from './material';
import { createFaunaPose, type FaunaPose } from './pose';
import { RING_POOL, ringsAt } from './rings';
import type { FaunaWorld } from './site';
import { WADER_LOOK, wader, waderSpecs, type WaderSpec } from './waders';
import { manatee, mullet } from './waterLife';

type Counts = QualitySettings['fauna'];

/** One InstancedMesh per shape (spec 5 §4.2): pelican, frigate, wader, mullet, manatee, ring. Allocation-free update. */
export class FaunaSet {
  readonly group = new THREE.Group();
  readonly rings: THREE.InstancedMesh;
  private readonly meshes: Record<Exclude<Shape, 'ring'>, THREE.InstancedMesh>;
  private readonly anim: Record<Exclude<Shape, 'ring'>, THREE.InstancedBufferAttribute>;
  private readonly ringAge: THREE.InstancedBufferAttribute;
  private readonly waders: WaderSpec[];
  private readonly mats: THREE.Material[] = [];
  private readonly pose: FaunaPose = createFaunaPose();
  private readonly ringBuf = new Float32Array(RING_POOL * 4);
  private readonly m = new THREE.Matrix4(); private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YZX'); private readonly p = new THREE.Vector3(); private readonly s = new THREE.Vector3();

  /** `reflect` false (low tier): the animals are left out of the water reflection pass altogether. */
  constructor(private readonly w: FaunaWorld, private readonly counts: Counts, castShadow: boolean, private readonly reflect = true) {
    this.waders = waderSpecs(w.site, counts.wadersPerLanding);
    const cap = { pelican: counts.flock + counts.fishers, frigate: counts.frigates, wader: this.waders.length, mullet: 1, manatee: 1 };
    const make = (shape: Exclude<Shape, 'ring'>) => {
      const g = buildFaunaShape(shape), n = Math.max(1, cap[shape]);
      const a = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aAnim', a);
      const { material, depth } = faunaMaterials(shape);
      this.mats.push(material, depth);
      const mesh = new THREE.InstancedMesh(g, material, n);
      mesh.name = shape; mesh.customDepthMaterial = depth;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = castShadow && shape === 'wader'; mesh.receiveShadow = false;
      mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
      this.group.add(mesh);
      return [mesh, a] as const;
    };
    const [pel, aPel] = make('pelican'), [fri, aFri] = make('frigate'), [wad, aWad] = make('wader'), [mul, aMul] = make('mullet'), [man, aMan] = make('manatee');
    this.meshes = { pelican: pel, frigate: fri, wader: wad, mullet: mul, manatee: man };
    this.anim = { pelican: aPel, frigate: aFri, wader: aWad, mullet: aMul, manatee: aMan };
    const c = new THREE.Color();
    this.waders.forEach((ws, i) => wad.setColorAt(i, c.setHex(WADER_LOOK[ws.kind].color)));
    if (wad.instanceColor) wad.instanceColor.needsUpdate = true;

    const rg = buildFaunaShape('ring');
    this.ringAge = new THREE.InstancedBufferAttribute(new Float32Array(RING_POOL), 1).setUsage(THREE.DynamicDrawUsage);
    rg.setAttribute('aRing', this.ringAge);
    const rm = ringMaterial(); this.mats.push(rm);
    this.rings = new THREE.InstancedMesh(rg, rm, RING_POOL);
    this.rings.name = 'ring'; this.rings.renderOrder = 1; this.rings.frustumCulled = false; this.rings.count = 0; this.rings.visible = false;
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.rings);
  }

  private put(shape: Exclude<Shape, 'ring'>, i: number) {
    const o = this.pose, mesh = this.meshes[shape], a = this.anim[shape];
    this.e.set(o.roll, o.yaw, o.pitch); this.q.setFromEuler(this.e);
    this.m.compose(this.p.set(o.x, o.y, o.z), this.q, this.s.setScalar(o.scale));
    mesh.setMatrixAt(i, this.m);
    a.setXYZ(i, o.flap, o.fold, o.legs);
    return i + 1;
  }
  private done(shape: Exclude<Shape, 'ring'>, used: number) {
    const mesh = this.meshes[shape];
    mesh.count = used; mesh.visible = used > 0;
    mesh.instanceMatrix.needsUpdate = true; this.anim[shape].needsUpdate = true;
  }

  update(clock: number) {
    const w = this.w, o = this.pose, c = this.counts;
    let n = 0;
    for (let i = 0; i < c.flock; i++) { pelicanFlock(clock, i, w, o); n = this.put('pelican', n); }
    for (let i = 0; i < Math.min(c.fishers, w.site.fishers.length); i++) { pelicanFisher(clock, i, w, o); n = this.put('pelican', n); }
    this.done('pelican', n);
    n = 0; for (let i = 0; i < c.frigates; i++) { frigate(clock, i, w, o); n = this.put('frigate', n); }
    this.done('frigate', n);
    n = 0; for (let i = 0; i < this.waders.length; i++) { wader(clock, this.waders[i], w, o); n = this.put('wader', n); }
    this.done('wader', n);
    n = 0; if (mullet(clock, w, o).on) n = this.put('mullet', n);
    this.done('mullet', n);
    n = 0; if (manatee(clock, w, o).on) n = this.put('manatee', n);
    this.done('manatee', n);

    const live = Math.min(RING_POOL, ringsAt(clock, w, Math.min(c.fishers, w.site.fishers.length), this.ringBuf)), b = this.ringBuf;
    for (let r = 0; r < live; r++) {
      this.m.makeScale(b[r * 4 + 3], 1, b[r * 4 + 3]).setPosition(b[r * 4], 0.02, b[r * 4 + 1]);
      this.rings.setMatrixAt(r, this.m);
      this.ringAge.setX(r, b[r * 4 + 2]);
    }
    this.rings.count = live; this.rings.visible = live > 0;
    this.rings.instanceMatrix.needsUpdate = true; this.ringAge.needsUpdate = true;
  }

  /** Reflection pass: rings lie on the mirror plane — hide them there; with `reflect` off, hide every animal. */
  beforeReflection = () => { this.rings.visible = false; if (!this.reflect) this.group.visible = false; };
  afterReflection = () => { this.rings.visible = this.rings.count > 0; this.group.visible = true; };

  dispose() {
    for (const o of [...this.group.children]) {
      const mesh = o as THREE.InstancedMesh;
      mesh.geometry.dispose(); mesh.dispose(); this.group.remove(mesh);
    }
    this.mats.forEach((m) => m.dispose());
  }
}
