import { expect, test } from 'vitest';
import { GOV, QualityGovernor } from './qualityGovernor';

/** Runs `seconds` at `fps` (one frame per tick); returns how many times it said 'down'. */
function run(g: QualityGovernor, seconds: number, fps: number, paused = false) {
  let downs = 0;
  for (let i = 0; i < Math.round(seconds * fps); i++) if (g.tick(1 / fps, 1, paused) === 'down') downs++;
  return downs;
}

test('first check: under 40 fps steps down once, after 2 s settle + 4 s measure', () => {
  const g = new QualityGovernor('medium');
  expect(run(g, GOV.settle + GOV.first - 0.2, 35)).toBe(0);
  expect(run(g, 0.4, 35)).toBe(1);
  expect(g.stage).toBe('pending');
  expect(run(g, 30, 10)).toBe(0);                 // waits for reset after a step
});
test('first check passes at 40 fps or more, then the watch needs 10 s under 30 fps', () => {
  const g = new QualityGovernor('high');
  expect(run(g, GOV.settle + GOV.first + 0.1, 45)).toBe(0);
  expect(g.stage).toBe('watch');
  expect(run(g, 9.5, 35)).toBe(0);                // 35 fps is fine while watching
  expect(run(g, 2 * GOV.window, 25)).toBe(1);
});
test('never steps up and stops on low', () => {
  const g = new QualityGovernor('low');
  expect(g.stage).toBe('done');
  expect(run(g, 60, 5)).toBe(0);
});
test('reset after a step: settle, then a fresh 40 fps first check on the new tier', () => {
  const g = new QualityGovernor('high');
  run(g, 7, 20);
  g.reset('medium');
  expect(g.stage).toBe('settle');
  expect(run(g, GOV.settle + GOV.first + 0.1, 38)).toBe(1);
  g.reset('low');
  expect(g.stage).toBe('done');
});
test('a pause throws the window away and settles 2 s before measuring again', () => {
  const g = new QualityGovernor('medium');
  run(g, GOV.settle + 3, 20);                     // 3 s into a slow first check
  run(g, 1, 60, true);                            // paused (dip, hidden tab)
  expect(g.stage).toBe('settle');
  expect(run(g, GOV.settle + GOV.first - 0.2, 20)).toBe(0);
  expect(run(g, 0.4, 20)).toBe(1);
});
test('after the first check passed, a pause returns to watching, not to a new first check', () => {
  const g = new QualityGovernor('medium');
  run(g, GOV.settle + GOV.first + 0.1, 50);
  run(g, 0.5, 60, true);
  run(g, GOV.settle + 0.1, 35);
  expect(g.stage).toBe('watch');
});
