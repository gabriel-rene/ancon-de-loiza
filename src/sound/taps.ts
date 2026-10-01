/**
 * Spec 6b §4: the few scene positions sound needs, written in place each frame by the scene (main chunk, a few
 * stores per frame) and read by the lazy sound chunk. Counts reset when the writer goes away.
 */
export const WADER_CAP = 32, CAR_CAP = 16, BRIDGE_CAP = 32;
/** A ferry car slower than this (m/s) is parked: no engine hum. */
export const CAR_MOVING = 0.3;
export const soundTaps = {
  waders: { n: 0, pos: new Float32Array(WADER_CAP * 3), flying: new Uint8Array(WADER_CAP) },
  cars: { n: 0, pos: new Float32Array(CAR_CAP * 3), speed: new Float32Array(CAR_CAP) },
  bridge: { n: 0, pos: new Float32Array(BRIDGE_CAP * 3), lane: new Uint8Array(BRIDGE_CAP) },
};
