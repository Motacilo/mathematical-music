import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://<user>.github.io/mathematical-music/
export default defineConfig({
  plugins: [react()],
  base: '/mathematical-music/',
})
