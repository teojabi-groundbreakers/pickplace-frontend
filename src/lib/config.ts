export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, ''),
  demoMode: import.meta.env.VITE_DEMO_MODE !== 'false',
  kakaoMapAppKey: import.meta.env.VITE_KAKAO_MAP_APP_KEY || '',
  requestTimeout: 30_000,
}
