// Configura Vite para compilar la aplicación React.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { INSTITUCION } from './src/config/institucion.js'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'titulo-institucional',
      transformIndexHtml() {
        return [{ tag: 'title', children: INSTITUCION.nombreApp, injectTo: 'head' }]
      },
    },
  ],
})
