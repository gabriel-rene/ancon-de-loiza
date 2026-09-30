// n8ao (the pass behind @react-three/postprocessing's <N8AO>) ships no types; the parts opaqueAO.test.ts uses.
declare module 'n8ao' {
  import type { Camera, Scene } from 'three';
  export class N8AOPostPass {
    constructor(scene: Scene, camera: Camera);
    autoDetectTransparency: boolean;
    configuration: { transparencyAware: boolean };
    detectTransparency(): void;
  }
}
