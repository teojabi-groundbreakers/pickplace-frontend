export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, ''),
  demoMode: import.meta.env.VITE_DEMO_MODE !== 'false',
  requestTimeout: 30_000,
}
