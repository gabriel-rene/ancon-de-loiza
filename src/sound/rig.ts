import * as THREE from 'three';
import type { PoseContext, VesselPose } from '../ancon/pose';
import type { ClipId } from './clips';
import type { Engine } from './engine';
import { birdCalls, ferryEvents, flushEdges, type FerryFrame, type FerrySpec, type SoundEvent } from './events';
import { createLevels, GAIN, mixLevels, type MixInput } from './mix';
import { soundTaps, WADER_CAP } from './taps';
import { VoicePool, VOICES } from './voices';

export interface SoundStats { state: AudioContextState; voices: number; buildMs: number; shots: number }
/** Test hook (spec 6b §6), like window.__ANCON_READY__ in src/scene/ReadySignal.tsx. */
declare global { interface Window { __ANCON_SOUND__?: SoundStats } }
/** Distance (m) at which each source plays at full gain; inverse roll-off beyond (spec 6b §1: 3D sound). */
const REF = { ferry: 8, wader: 6, car: 6, bridge: 30 } as const;

const _v = new THREE.Vector3();
const frameOf = (): FerryFrame => ({ clock: 0, phase: 'load', tLeg: 0, effort: 0 });

/** Every Audio object of the scene, created once; update() is allocation-free. */
export class SoundRig {
  readonly group = new THREE.Group();
  readonly stats: SoundStats;
  private readonly water: THREE.Audio; private readonly wind: THREE.Audio;
  private readonly traffic: THREE.PositionalAudio[]; private readonly engines: THREE.PositionalAudio[];
  private readonly shots: THREE.PositionalAudio[];
  private readonly pool = new VoicePool(VOICES.shots);
  private readonly levels = createLevels();
  private readonly events: SoundEvent[] = [];
  private readonly prevFlying = new Uint8Array(WADER_CAP);
  private readonly ferryPos = new THREE.Vector3();
  private prev = frameOf(); private cur = frameOf(); private fresh = false; private havePrev = false;
  private spec: FerrySpec | null = null;
  private birdT = 0;
  private readonly nearest = new Int32Array(VOICES.engines);

  constructor(private readonly eng: Engine) {
    const L = eng.listener;
    const loop = <A extends THREE.Audio<AudioNode>>(a: A, id: ClipId): A => { a.setBuffer(eng.buffers[id]); a.setLoop(true); a.setVolume(0); return a; };
    const placed = (ref: number) => {
      const a = new THREE.PositionalAudio(L);
      a.setRefDistance(ref); a.setRolloffFactor(1); a.setDistanceModel('inverse'); a.setMaxDistance(20000);
      this.group.add(a);
      return a;
    };
    this.water = loop(new THREE.Audio(L), 'water');
    this.wind = loop(new THREE.Audio(L), 'wind');
    this.traffic = Array.from({ length: VOICES.traffic }, () => loop(placed(REF.bridge), 'traffic'));
    this.engines = Array.from({ length: VOICES.engines }, () => loop(placed(REF.car), 'engine'));
    this.shots = Array.from({ length: VOICES.shots }, () => placed(REF.ferry));
    this.stats = { state: eng.ctx.state, voices: 0, buildMs: eng.buildMs, shots: 0 };
  }

  start() { for (const a of [this.water, this.wind, ...this.traffic, ...this.engines]) a.play(); }
  stop() {
    for (const a of [this.water, this.wind, ...this.traffic, ...this.engines, ...this.shots]) { if (a.isPlaying) a.stop(); a.disconnect(); a.gain.disconnect(); }
  }

  /** Called from onVesselPose (right after <Ancon> moves the ferry). Copies; never keeps the shared pose. */
  ferry(pose: VesselPose, ctx: PoseContext) {
    const s = pose.state, c = this.cur;
    c.clock = pose.clock; c.phase = s.phase; c.tLeg = s.tLeg; c.effort = s.effort;
    this.ferryPos.copy(pose.position);
    const sp = ctx.spec;
    if (!this.spec || this.spec.propulsion !== sp.propulsion || this.spec.crew !== sp.crew || this.spec.load !== sp.timings.load || this.spec.moored !== sp.moored)
      this.spec = { propulsion: sp.propulsion, crew: sp.crew, moored: sp.moored, load: sp.timings.load };
    this.fresh = true;
  }

  update(dt: number, mix: MixInput, cam: THREE.Vector3) {
    const L = this.levels, now = this.eng.ctx.currentTime;
    mixLevels(mix, L);
    this.eng.listener.setMasterVolume(L.master);
    this.water.setVolume(L.water); this.wind.setVolume(L.wind);

    const ev = this.events; ev.length = 0;
    if (this.fresh && this.spec) {
      if (this.havePrev) ferryEvents(this.prev, this.cur, this.spec, ev);
      const p = this.prev; this.prev = this.cur; this.cur = p; this.havePrev = true; this.fresh = false;
    }
    const w = soundTaps.waders;
    this.birdT += Math.min(dt, 0.1);
    birdCalls(this.birdT - Math.min(dt, 0.1), this.birdT, w.n, L.birdRate, ev);
    flushEdges(this.prevFlying, w.flying, w.n, ev);
    this.prevFlying.set(w.flying);
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.source === 'wader') {
        if (e.clip !== 'flap' && w.flying[e.index]) continue;   // no calls in flight
        _v.set(w.pos[e.index * 3], w.pos[e.index * 3 + 1] + 0.6, w.pos[e.index * 3 + 2]);
      } else _v.copy(this.ferryPos);
      this.play(e, _v, now);
    }

    this.placeEngines(cam);
    this.placeTraffic(cam, L.traffic);
    let voices = (L.water > 0 ? 1 : 0) + (L.wind > 0 ? 1 : 0) + this.pool.active(now);
    for (const a of this.engines) if (a.getVolume() > 0) voices++;
    for (const a of this.traffic) if (a.getVolume() > 0) voices++;
    this.stats.voices = voices; this.stats.state = this.eng.ctx.state;
  }

  private play(e: SoundEvent, at: THREE.Vector3, now: number) {
    const buf = this.eng.buffers[e.clip], i = this.pool.acquire(now, buf.duration / e.rate), a = this.shots[i];
    if (a.isPlaying) a.stop();
    a.setRefDistance(e.source === 'wader' ? REF.wader : REF.ferry);
    a.setBuffer(buf); a.setPlaybackRate(e.rate); a.setVolume(e.gain);
    a.position.copy(at);
    a.play();
    this.stats.shots++;
  }

  /** The VOICES.engines moving ferry cars nearest the camera hum; the rest are silent. */
  private placeEngines(cam: THREE.Vector3) {
    const c = soundTaps.cars, near = this.nearest;
    near.fill(-1);
    for (let k = 0; k < c.n; k++) {
      const d = cam.distanceToSquared(_v.set(c.pos[k * 3], c.pos[k * 3 + 1], c.pos[k * 3 + 2]));
      for (let j = 0; j < near.length; j++) {
        const o = near[j];
        if (o < 0 || d < cam.distanceToSquared(_v.set(c.pos[o * 3], c.pos[o * 3 + 1], c.pos[o * 3 + 2]))) {
          for (let m = near.length - 1; m > j; m--) near[m] = near[m - 1];
          near[j] = k; break;
        }
      }
    }
    for (let j = 0; j < this.engines.length; j++) {
      const a = this.engines[j], k = near[j];
      if (k < 0) { a.setVolume(0); continue; }
      const sp = Math.min(1, c.speed[k] / 3);
      a.position.set(c.pos[k * 3], c.pos[k * 3 + 1] + 0.5, c.pos[k * 3 + 2]);
      a.setVolume(GAIN.engine * sp); a.setPlaybackRate(0.85 + 0.15 * sp);
    }
  }

  /** One hum per bridge lane, at that lane's car nearest the camera. */
  private placeTraffic(cam: THREE.Vector3, level: number) {
    const b = soundTaps.bridge;
    for (let lane = 0; lane < this.traffic.length; lane++) {
      let best = -1, bd = Infinity;
      for (let k = 0; k < b.n; k++) {
        if (b.lane[k] !== lane) continue;
        const d = cam.distanceToSquared(_v.set(b.pos[k * 3], b.pos[k * 3 + 1], b.pos[k * 3 + 2]));
        if (d < bd) { bd = d; best = k; }
      }
      const a = this.traffic[lane];
      if (best < 0 || level === 0) { a.setVolume(0); continue; }
      a.position.set(b.pos[best * 3], b.pos[best * 3 + 1] + 0.5, b.pos[best * 3 + 2]);
      a.setVolume(level);
    }
  }
}
