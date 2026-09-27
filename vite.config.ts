/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/ancon-de-loiza/',
  plugins: [react()],
  // CI runners are ~4× slower than the dev Mac; the heaviest choreography sweeps take ~1.7 s locally.
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'], environment: 'node', testTimeout: 30_000 },
});
