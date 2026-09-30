// src/ancon/CrewSet.ts
import * as THREE from 'three';
import { FigureBatch } from '../people/figureBatch';
import { createFigureMaterial } from '../people/material';
import type { FigureLook } from '../people/palettes';
import { createFigurePose, poseFigure, segmentMatrix, type Body, type FigurePose } from '../people/rig';
import { actorFrame, createActorFrame, type Actor, type ActorCtx, type ActorFrame, type DeckLoad } from './crew';
import { buildPole } from './pole';
import type { VesselPose } from './pose';

const _w = new THREE.Matrix4(), _p = new THREE.Matrix4();
const _g = new THREE.Vector3();

/**
 * The crew and passengers of one era: one 'hi' FigureBatch for everyone on board (one draw call per
 * part / hat / hair kind in use — never a second batch) and one InstancedMesh for the poles. World
 * space: every figure and pole is deck-local × the vessel pose, so they ride the hull's heave, pitch and
 * roll. Visible in the shadow and reflection passes like the hull.
 */
export class CrewSet {
  readonly group = new THREE.Group();
  poleCount = 0;
  private readonly batch: FigureBatch;
  private readonly poles: THREE.InstancedMesh;
  private readonly frames: ActorFrame[];
  private readonly bodies: Body[];
  private readonly poses: FigurePose[];
  private readonly figMat = createFigureMaterial();
  private readonly poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  private ground?: (x: number, z: number) => number;
  private pose?: VesselPose;
  /** Deck-local ground height under deck-local (x, z). Ground Y minus the world Y of deck-local (x, 0, z): right under heave, pitch and roll to first order. */
  private readonly groundLocal = (x: number, z: number) => {
    const p = this.pose!;
    _g.set(x, 0, z).applyMatrix4(p.matrix);
    return this.ground!(_g.x, _g.z) - _g.y;
  };
  private readonly actx: ActorCtx = { spec: undefined!, layout: undefined! };
  /** Phase 4c: figure slots after the actors hold the load's people (TrafficSet); their goads join the poles. */
  private readonly extraBase: number;
  private readonly extraPoles: THREE.Matrix4[];
  private extraPoleN = 0;

  constructor(private readonly actors: Actor[], extras: FigureLook[] = []) {
    const n = Math.max(1, actors.length + extras.length);
    this.extraBase = actors.length;
    this.batch = new FigureBatch(n, this.figMat, 'hi');
    actors.forEach((a, i) => this.batch.setLook(i, a.look));
    extras.forEach((l, k) => this.batch.setLook(this.extraBase + k, l));
    for (let i = 0; i < n; i++) this.batch.hide(i);
    this.extraPoles = extras.map(() => new THREE.Matrix4());
    this.poles = new THREE.InstancedMesh(buildPole(1), this.poleMat, n);
    // Poles (3–4 cm thick) cast no shadow: a sub-texel line in the 4096 map, and a draw call in the shadow pass.
    this.poles.count = 0; this.poles.castShadow = false; this.poles.receiveShadow = true; this.poles.frustumCulled = false;
    this.poles.visible = false;
    this.frames = actors.map(createActorFrame);
    this.bodies = actors.map((a) => ({ height: a.look.height, build: a.look.build, dress: a.look.dress }));
    this.poses = actors.map(createFigurePose);
    this.group.add(this.batch.group, this.poles);
  }

  update(pose: VesselPose, ctx: ActorCtx & { groundAt?: (x: number, z: number) => number }, loadAt?: (leg: number) => DeckLoad) {
    this.pose = pose; this.ground = ctx.groundAt;
    const actx = this.actx;
    actx.spec = ctx.spec; actx.layout = ctx.layout; actx.groundLocal = ctx.groundAt ? this.groundLocal : undefined; actx.loadAt = loadAt;
    let pi = 0;
    for (let i = 0; i < this.actors.length; i++) {
      const f = actorFrame(this.actors[i], pose.state, pose.clock, actx, this.frames[i]);
      if (!f.visible) { this.batch.hide(i); continue; }
      _w.makeRotationY(f.yaw).setPosition(f.pos[0], f.pos[1], f.pos[2]).premultiply(pose.matrix);
      this.batch.set(i, _w, poseFigure(this.bodies[i], f.pose, this.poses[i]));
      if (f.hasPole) this.poles.setMatrixAt(pi++, segmentMatrix(f.poleTop, f.poleTip, 1, 1, _p).premultiply(pose.matrix));
    }
    for (let j = 0; j < this.extraPoleN; j++) this.poles.setMatrixAt(pi++, this.extraPoles[j]);
    this.extraPoleN = 0;
    this.poles.count = pi; this.poleCount = pi; this.poles.visible = pi > 0;
    this.poles.instanceMatrix.needsUpdate = true;
    this.batch.commit();
  }

  /** The load's people (TrafficSet): write before update(), which commits the batch. `pole`: an ox driver's goad (world). */
  setExtra(k: number, world: THREE.Matrix4, pose: FigurePose, pole?: THREE.Matrix4) {
    this.batch.set(this.extraBase + k, world, pose);
    if (pole) this.extraPoles[this.extraPoleN++].copy(pole);
  }
  hideExtra(k: number) { this.batch.hide(this.extraBase + k); }

  dispose() {
    this.batch.dispose(); this.poles.dispose(); this.poles.geometry.dispose();
    this.figMat.dispose(); this.poleMat.dispose();
    this.group.clear();
  }
}
