import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { expect, test } from 'vitest';
import { patchSkyShader } from './skyShader';

test("patches the installed three's Sky shader (fails CI if an upgrade moves the anchors)", () => {
  const out = patchSkyShader((Sky.SkyShader as { fragmentShader: string }).fragmentShader);
  expect(out).toContain('uniform float uGain;');
  expect(out).toContain('uniform float uShoulder;');
  expect(out).toContain('skyC + sundiscColor * uGain');
  expect(out).not.toContain('gl_FragColor = vec4( texColor, 1.0 );');
});
test('throws when the target lines are missing', () => {
  expect(() => patchSkyShader('void main() { gl_FragColor = vec4(1.0); }')).toThrow(/patchSkyShader/);
});
