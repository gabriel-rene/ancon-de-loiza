/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/ancon-de-loiza/',
  plugins: [react()],
  // Spec 7a §5: the 3D libraries change less often than the app, so repeat visits keep this chunk cached.
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
    { name: 'vendor-3d', test: /node_modules[\\/](three|@react-three|postprocessing|n8ao|three-custom-shader-material|camera-controls)[\\/]/ },
  ] } } } },
  // CI runners are ~4× slower than the dev Mac; the heaviest choreography sweeps take ~1.7 s locally.
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'], environment: 'node', testTimeout: 30_000 },
});
