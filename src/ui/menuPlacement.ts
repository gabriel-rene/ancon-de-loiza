/** Left offset of a dropdown menu relative to its button (spec 7a §3): left-aligned with the button, shifted left only when it would
 *  overflow the right edge, and never past the left gutter. A menu wider than the space sits at the left gutter. */
export function menuLeft(buttonLeft: number, menuWidth: number, viewportWidth: number, gutter = 8): number {
  const left = Math.max(gutter, Math.min(buttonLeft, viewportWidth - gutter - menuWidth));
  return left - buttonLeft;
}
