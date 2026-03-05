import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Separate Vite config for the demo app.
// Run with: npm run dev
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'lux-react': resolve(__dirname, 'src/index.ts'),
      'lux-opcua': resolve(__dirname, '../LuxConnect/src/index.ts'),
    },
  },
});
