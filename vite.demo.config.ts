import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Separate Vite config for the demo app.
// Run with: npm run dev
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const plcHost = env['VITE_HOST'] ?? 'localhost';
  const plcPort = env['VITE_PORT'] ?? '8443';
  const plcProtocol = env['VITE_PROTOCOL'] ?? 'https';
  const plcTarget = `${plcProtocol}://${plcHost}:${plcPort}`;

  // Build optional auth header if credentials provided in env
  const plcUser = env['VITE_USER'] ?? '';
  const plcPass = env['VITE_PASS'] ?? '';
  const authHeader = plcUser ? `Basic ${Buffer.from(`${plcUser}:${plcPass}`).toString('base64')}` : undefined;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        'lux-react': resolve(__dirname, 'src/index.ts'),
        'lux-opcua': resolve(__dirname, '../LuxConnect/src/index.ts'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: plcTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          // Forward basic auth header when user/pass provided in .env.local
          headers: authHeader ? { Authorization: authHeader } : undefined,
          configure: (proxy) => {
            // Ensure WebSocket upgrade requests also include Authorization header
            if (authHeader) {
              proxy.on('proxyReqWs', (proxyReq) => {
                proxyReq.setHeader('Authorization', authHeader);
              });
            }
          },
        },
      },
    },
  };
});
