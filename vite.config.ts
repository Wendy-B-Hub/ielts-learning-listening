import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: '雅思听力词汇',
          short_name: '听力词汇',
          description: '雅思听力词汇听音辨词练习 · 先听后认，模拟考场',
          start_url: './',
          display: 'standalone',
          background_color: '#f0f4ff',
          theme_color: '#1d4ed8',
          lang: 'zh-CN',
          icons: [
            { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
            { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,json}'],
          runtimeCaching: [
            // 生产：缓存 COS 上的 MP3（CacheFirst，30天）
            ...(env.VITE_COS_BASE_URL ? [{
              urlPattern: new RegExp(`^${env.VITE_COS_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
              handler: 'CacheFirst' as const,
              options: {
                cacheName: 'cos-audio-cache',
                expiration: { maxEntries: 700, maxAgeSeconds: 60 * 60 * 24 * 60 },
              },
            }] : []),
            // 开发/备用：本地 TTS API
            {
              urlPattern: /\/api\/tts\/audio/,
              handler: 'CacheFirst' as const,
              options: {
                cacheName: 'tts-audio-cache',
                expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
    // 部署路径：挂到已备案域名子路径时设 VITE_BASE=/listen/（见 .env.production）；
    // 不设则相对路径，根目录或 IP:端口 也能用。
    base: env.VITE_BASE || './',
    server: {
      port: 5201,
      proxy: { '/api': 'http://127.0.0.1:5200' },
    },
  }
})
