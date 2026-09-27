import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/* GitHub Pages serves the site under /<repo>/, so the deploy workflow sets
   this; locally the app stays at the root. */
const base = process.env.PAGES_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5199 },
})
