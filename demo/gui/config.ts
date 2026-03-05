/**
 * Connection configuration for the demo app.
 * Edit these values to point at your OPC UA server.
 *
 * All settings can be overridden with environment variables:
 *   VITE_OPC_HOST      — server hostname or IP  (default: localhost)
 *   VITE_OPC_PORT      — HTTP port              (default: 4840)
 *   VITE_OPC_PROTOCOL  — 'http' or 'https'      (default: http)
 *   VITE_OPC_USER      — username               (default: empty)
 *   VITE_OPC_PASS      — password               (default: empty)
 *
 * Create a .env.local file in the LuxReact root to set these without editing code:
 *   VITE_OPC_HOST=192.168.1.10
 *   VITE_OPC_PORT=80
 */
export const connectionConfig = {
  host:     import.meta.env['VITE_OPC_HOST']     ?? 'localhost',
  port:     Number(import.meta.env['VITE_OPC_PORT']     ?? 8000),
  protocol: (import.meta.env['VITE_OPC_PROTOCOL'] ?? 'http') as 'http' | 'https',
  username: import.meta.env['VITE_OPC_USER']     ?? '',
  password: import.meta.env['VITE_OPC_PASS']     ?? '',
};
