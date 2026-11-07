import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'PICKPLACE_')
  const target = env.PICKPLACE_API_PROXY_TARGET?.trim()
  if (command !== 'serve' || !target) return { plugins: [react()] }

  const proxyError = 'PICKPLACE_API_PROXY_TARGET에는 경로 없는 HTTP(S) 서버 주소를 설정하세요.'
  let origin: URL
  try {
    origin = new URL(target)
  } catch {
    throw new Error(proxyError)
  }

  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(proxyError)
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '^/api(?:/|$)': {
          target: origin.origin,
          changeOrigin: true,
        },
      },
    },
  }
})
