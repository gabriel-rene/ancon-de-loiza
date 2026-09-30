/** One animal's pose this frame (world space). `flap` wing angle (rad, up +), `fold` 0 open … 1 folded, `legs` 0 down … 1 trailing. */
export interface FaunaPose {
  x: number; y: number; z: number;
  yaw: number; pitch: number; roll: number; scale: number;
  flap: number; fold: number; legs: number;
  on: boolean;
}
export const createFaunaPose = (): FaunaPose =>
  ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, flap: 0, fold: 0, legs: 0, on: false });

/** three.js rotY that turns model +X onto the XZ heading (hx, hz). */
export const yawOf = (hx: number, hz: number) => Math.atan2(-hz, hx);

export const smooth = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

/** Bank angle for a coordinated turn. A right turn (yaw decreasing) lowers the right (+Z) wing: +roll. */
export const bankFor = (yawRate: number, speed: number, max = 0.6) =>
  Math.max(-max, Math.min(max, Math.atan((-yawRate * speed) / 9.81)));
