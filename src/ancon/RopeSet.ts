// src/ancon/RopeSet.ts
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import type { WorldFields } from '../terrain/fields';
import type { CrossingGeometry } from './geometry';
import type { VesselPose } from './pose';
import { cleatLocal, guideLocal, mooringLocal, ropeRig, shoreRopePost, upstreamSide, type RopeRig } from './rigging';
import { spanSag, tubeIndex, writeRopeLine, writeSpan, writeTube, type V3 } from './rope';
import type { DeckLayout, VesselSpec } from './spec';

const ROPE_R = 0.022;
interface Line { mesh: THREE.Mesh; pts: Float32Array; count: number }
const _v = new THREE.Vector3();
const toWorld = (p: V3, m: THREE.Matrix4, out: V3): V3 => { _v.set(p[0], p[1], p[2]).applyMatrix4(m); out[0] = _v.x; out[1] = _v.y; out[2] = _v.z; return out; };

/**
 * Ropes for the era, rebuilt in place every frame: 'haul' (1935–1984, two ropes bank to bank over
 * the deck guides), 'shore' (1840, one slack rope from the Loíza bank to the gunwale), 'moor'
 * (1986, two short lines to the Loíza posts). One draw call per rope + one for the posts.
 */
export class RopeSet {
  readonly group = new THREE.Group();
  private lines: Line[] = [];
  private mode: 'haul' | 'shore' | 'moor' | 'none';
  private rig: RopeRig | null = null;
  private shorePost: V3 | null = null;
  private readonly a: V3 = [0, 0, 0]; private readonly b: V3 = [0, 0, 0];
  private readonly material: THREE.Material;
  private postMaterial: THREE.Material | null = null;
  private posts: THREE.InstancedMesh | null = null;
  private readonly local: V3 = [0, 0, 0];
  private readonly shoreSide: 1 | -1;
  private readonly uPx = { value: 0.001 };

  constructor(private o: { spec: VesselSpec; layout: DeckLayout; geom: CrossingGeometry; fields: WorldFields; segments: number; radial: number }) {
    const { spec } = o;
    this.shoreSide = upstreamSide(o.geom);
    this.mode = spec.moored ? 'moor' : spec.propulsion === 'ropes' ? 'haul' : spec.shoreRope ? 'shore' : 'none';
    // Ropes stay at least ~0.6 px wide on screen: grow along the normal with distance (no shimmer at bank range).
    this.material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshStandardMaterial,
      color: spec.kind === 'steelPontoon' ? 0x4a4036 : 0x8a7652, roughness: 0.95,
      uniforms: { uPx: this.uPx, uR: { value: ROPE_R } },
      vertexShader: /* glsl */ `
        uniform float uPx; uniform float uR;
        void main() {
          float d = length((modelViewMatrix * vec4(position, 1.0)).xyz);
          csm_Position = position + normal * max(0.0, 0.6 * uPx * d - uR);
        }`,
    });
    const count = this.mode === 'haul' ? 2 * (o.segments + 1) : this.mode === 'shore' ? 2 * o.segments + 1 : this.mode === 'moor' ? 9 : 0;
    const nLines = this.mode === 'haul' || this.mode === 'moor' ? 2 : this.mode === 'shore' ? 1 : 0;
    for (let i = 0; i < nLines; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * o.radial * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * o.radial * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setIndex(new THREE.BufferAttribute(tubeIndex(count, o.radial), 1));
      const mesh = new THREE.Mesh(g, this.material);
      mesh.frustumCulled = false; mesh.receiveShadow = true;
      this.group.add(mesh);
      this.lines.push({ mesh, pts: new Float32Array(count * 3), count });
    }
    if (this.mode === 'haul' || this.mode === 'moor') this.rig = ropeRig(o.geom, o.layout, o.fields);
    if (this.mode === 'shore') this.shorePost = shoreRopePost(o.geom, o.fields);
    this.addPosts();
  }
  get lineCount() { return this.lines.length; }

  private addPosts() {
    const tops: V3[] = this.rig ? (this.mode === 'moor' ? [...this.rig.east] : [...this.rig.east, ...this.rig.west]) : this.shorePost ? [this.shorePost] : [];
    if (!tops.length) return;
    this.postMaterial = new THREE.MeshStandardMaterial({ color: 0x4f4234, roughness: 0.9 });
    const posts = (this.posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 1.8, 8), this.postMaterial, tops.length));
    const m = new THREE.Matrix4();
    for (let i = 0; i < tops.length; i++) posts.setMatrixAt(i, m.makeTranslation(tops[i][0], tops[i][1] + 0.1 - 0.9, tops[i][2]));   // 1.8 m post, top 0.1 m above the rope eye
    posts.castShadow = true; posts.receiveShadow = true;
    this.group.add(posts);
  }

  /** Rebuild every rope for this pose. `pxScale` = world metres per pixel at 1 m distance (2·tan(fov/2)/viewport height). */
  update(pose: VesselPose, pxScale: number) {
    this.uPx.value = pxScale;
    const { layout: L, segments, radial } = this.o, m = pose.matrix, slack = pose.state.slack;
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i], k = i as 0 | 1;
      if (this.mode === 'haul' && this.rig) {
        const gE = toWorld(guideLocal(L, -1, k, this.local), m, this.a), gW = toWorld(guideLocal(L, 1, k, this.local), m, this.b);
        writeRopeLine(this.rig.east[k], gE, gW, this.rig.west[k], slack, segments, line.pts);
      } else if (this.mode === 'moor' && this.rig) {
        const bitt = toWorld(mooringLocal(L, k, this.local), m, this.a), p = this.rig.east[k];
        writeSpan(bitt, p, spanSag(Math.hypot(p[0] - bitt[0], p[2] - bitt[2]), 0.6), line.count - 1, line.pts, 0);
      } else if (this.shorePost) {
        const cleat = toWorld(cleatLocal(L, this.shoreSide, this.local), m, this.a), p = this.shorePost;
        writeSpan(p, cleat, spanSag(Math.hypot(cleat[0] - p[0], cleat[2] - p[2]), 1), line.count - 1, line.pts, 0);
      }
      const g = line.mesh.geometry;
      writeTube(line.pts, line.count, ROPE_R, radial, g.attributes.position.array as Float32Array, g.attributes.normal.array as Float32Array);
      g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    }
  }

  dispose() {
    this.group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    // InstancedMesh.dispose() frees the instanceMatrix buffer (geometry.dispose() alone leaves it on the GPU).
    this.posts?.dispose();
    this.material.dispose();
    this.postMaterial?.dispose();
    this.group.clear();
  }
}
