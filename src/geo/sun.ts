import { ORIGIN } from './project';

const RAD = Math.PI / 180;

/** NOAA solar position. Azimuth from north clockwise, elevation above horizon (no refraction). */
export function sunPosition(date: Date, lat: number, lon: number) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const tst = (((minutes + eqTime + 4 * lon) % 1440) + 1440) % 1440;
  const ha = (tst / 4 - 180) * RAD;
  const phi = lat * RAD;
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZ)));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi));
  return { azimuth: (az / RAD + 180 + 360) % 360, elevation: 90 - zen / RAD };
}

/** Sun for a calendar date at local Atlantic Standard Time (UTC-4). */
export function sunAt(dateISO: string, hoursAST: number) {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setTime(d.getTime() + (hoursAST + 4) * 3600_000);
  return sunPosition(d, ORIGIN.lat, ORIGIN.lon);
}

/** Unit vector toward the sun in world frame (+X east, +Y up, +Z south). */
export function sunDirection(azimuth: number, elevation: number): [number, number, number] {
  const a = azimuth * RAD, el = elevation * RAD;
  return [Math.sin(a) * Math.cos(el), Math.sin(el), -Math.cos(a) * Math.cos(el)];
}
