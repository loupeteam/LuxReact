/**
 * Connection configuration for the demo app.
 *
 * In dev mode, Vite proxies /api/* requests to the real PLC server,
 * avoiding CORS issues. The proxy target is configured from these
 * same env vars in vite.demo.config.ts.
 *
 * For production or direct connection, set the real host/port/protocol.
 *
 * All settings can be overridden with environment variables:
 *   VITE_HOST      — server hostname or IP  (default: localhost)
 *   VITE_PORT      — HTTP port              (default: 8443)
 *   VITE_PROTOCOL  — 'http' or 'https'      (default: https)
 *   VITE_USER      — username               (default: empty)
 *   VITE_PASS      — password               (default: empty)
 *   VITE_GUEST_USER — view-only user         (default: empty)
 *   VITE_GUEST_PASS — view-only password     (default: empty)
 *
 * Create a .env.local file in the LuxReact root to set these without editing code.
 */

const isDev = import.meta.env.DEV;

export const connectionConfig = {
  // In dev mode, talk to the Vite dev server (same origin) which proxies to the PLC.
  // In production, connect directly to the PLC.
  host:     isDev ? location.hostname               : (import.meta.env['VITE_HOST']     ?? 'localhost'),
  port:     isDev ? Number(location.port)            : Number(import.meta.env['VITE_PORT'] ?? 8443),
  protocol: isDev ? (location.protocol === 'https:' ? 'https' : 'http') as 'http' | 'https'
                  : (import.meta.env['VITE_PROTOCOL'] ?? 'https') as 'http' | 'https',
  username: import.meta.env['VITE_USER']     ?? '',
  password: import.meta.env['VITE_PASS']     ?? '',
  guestUsername: import.meta.env['VITE_GUEST_USER'] ?? '',
  guestPassword: import.meta.env['VITE_GUEST_PASS'] ?? '',
  namespace: Number(import.meta.env['VITE_NAMESPACE'] ?? 6), // Default namespace index for demo PLC variables
};
