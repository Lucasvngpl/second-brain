import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // './' makes asset paths relative so Electron can load them via file:// in production
  base: './',
})
