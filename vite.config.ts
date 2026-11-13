import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => mode === 'demo'
  // Versão de teste: um único HTML, sem servidor
  ? { plugins: [react(), viteSingleFile()], build: { outDir: 'dist-demo', assetsInlineLimit: 100000000 } }
  : {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.png', 'escudo.png', 'coroa.png', 'medalhao.png'],
      manifest: {
        name: 'Real Marditos FC',
        short_name: 'Marditos',
        description: 'App da patota Real Marditos FC',
        lang: 'pt-BR',
        theme_color: '#0B0E1A',
        background_color: '#0B0E1A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
