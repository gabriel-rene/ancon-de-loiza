// src/ancon/CrewSet.ts
import * as THREE from 'three';
import { FigureBatch } from '../people/figureBatch';
import { createFigureMaterial } from '../people/material';
import { createFigurePose, poseFigure, segmentMatrix, type Body, type FigurePose } from '../people/rig';
import { actorFrame, createActorFrame, type Actor, type ActorCtx, type ActorFrame } from './crew';
import { buildPole } from './pole';
import type { VesselPose } from './pose';

const _w = new THREE.Matrix4(), _p = new THREE.Matrix4();

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

  constructor(private readonly actors: Actor[]) {
    const n = Math.max(1, actors.length);
    this.batch = new FigureBatch(n, this.figMat, 'hi');
    actors.forEach((a, i) => this.batch.setLook(i, a.look));
    for (let i = 0; i < n; i++) this.batch.hide(i);
    this.poles = new THREE.InstancedMesh(buildPole(1), this.poleMat, n);
    this.poles.count = 0; this.poles.castShadow = this.poles.receiveShadow = true; this.poles.frustumCulled = false;
    this.poles.visible = false;
    this.frames = actors.map(createActorFrame);
    this.bodies = actors.map((a) => ({ height: a.look.height, build: a.look.build, dress: a.look.dress }));
    this.poses = actors.map(createFigurePose);
    this.group.add(this.batch.group, this.poles);
  }

  update(pose: VesselPose, ctx: ActorCtx) {
    let pi = 0;
    for (let i = 0; i < this.actors.length; i++) {
      const f = actorFrame(this.actors[i], pose.state, pose.clock, ctx, this.frames[i]);
      if (!f.visible) { this.batch.hide(i); continue; }
      _w.makeRotationY(f.yaw).setPosition(f.pos[0], f.pos[1], f.pos[2]).premultiply(pose.matrix);
      this.batch.set(i, _w, poseFigure(this.bodies[i], f.pose, this.poses[i]));
      if (f.hasPole) this.poles.setMatrixAt(pi++, segmentMatrix(f.poleTop, f.poleTip, 1, 1, _p).premultiply(pose.matrix));
    }
    this.poles.count = pi; this.poleCount = pi; this.poles.visible = pi > 0;
    this.poles.instanceMatrix.needsUpdate = true;
    this.batch.commit();
  }

  dispose() {
    this.batch.dispose(); this.poles.dispose(); this.poles.geometry.dispose();
    this.figMat.dispose(); this.poleMat.dispose();
    this.group.clear();
  }
}
