/** The parts of n8ao's N8AOPostPass that opaqueAO touches (the package ships no types). */
export interface N8AOTransparency { autoDetectTransparency: boolean; configuration: { transparencyAware: boolean } }

/**
 * N8AO turns on its transparency-aware mode as soon as any material in the scene is `transparent` — it checks every
 * object, visible or not — and then renders the scene twice more per frame into two full-resolution targets: about
 * 2 ms a frame on high (Phase 4c: the cars' glass, measured in the 4c perf report). The only transparent surfaces are
 * that glass (34 % opaque, no depth write, drawn after the opaque load), so AO keeps the opaque-only path it had before
 * 4c: the cabin seen through the glass takes the AO. Pass as the N8AO `ref`.
 */
export function opaqueAO(pass: N8AOTransparency | null) {
  if (!pass) return;
  pass.autoDetectTransparency = false;
  pass.configuration.transparencyAware = false;
}
