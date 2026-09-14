import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineConfig({
  base: '/attendencetracker-/',

  plugins: [
    react(),

    {
      name: 'github-pages-spa-fallback',

      closeBundle() {
        const indexFile = resolve(process.cwd(), 'dist', 'index.html')
        const fallbackFile = resolve(process.cwd(), 'dist', '404.html')

        if (existsSync(indexFile)) {
          copyFileSync(indexFile, fallbackFile)
          console.log('GitHub Pages SPA fallback created: dist/404.html')
        }
      },
    },
  ],
})