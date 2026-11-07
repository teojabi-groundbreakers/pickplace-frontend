export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, ''),
  demoMode: import.meta.env.VITE_DEMO_MODE !== 'false',
  kakaoMapAppKey: import.meta.env.VITE_KAKAO_MAP_APP_KEY || '',
  serviceApiPreview: import.meta.env.VITE_SERVICE_API_PREVIEW === 'true',
  requestTimeout: 30_000,
}
