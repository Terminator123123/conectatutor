// Configura Vite para compilar la aplicación React.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { INSTITUCION } from './src/config/institucion.js'

export default defineConfig({
  // En desarrollo, /api se reenvía a la API local: así otro equipo de la red (un celular)
  // solo necesita llegar al puerto de la página. Se usa con VITE_API_URL=/api.
  server: {
    // xfwd: la API recibe la dirección del equipo que pidió la página (para el registro).
    proxy: { '/api': { target: 'http://localhost:3000', xfwd: true } },
  },
  plugins: [
    react(),
    {
      // Registra en la consola quién abre la aplicación (solo en desarrollo).
      name: 'registro-de-visitas',
      configureServer(servidor) {
        servidor.middlewares.use((req, _res, next) => {
          if (req.method === 'GET' && String(req.headers.accept ?? '').includes('text/html')) {
            const hora = new Date().toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' })
            const equipo = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '')
            const dispositivo = /Mobile|Android|iPhone/i.test(req.headers['user-agent'] ?? '') ? 'celular' : 'computador'
            console.log(`[WEB] ${hora} ${equipo} (${dispositivo}) abrió ${req.url.split('?')[0]}`)
          }
          next()
        })
      },
    },
    {
      name: 'titulo-institucional',
      transformIndexHtml() {
        return [
          { tag: 'title', children: INSTITUCION.nombreApp, injectTo: 'head' },
          {
            tag: 'link',
            attrs: { rel: 'icon', type: 'image/png', href: INSTITUCION.logos.favicon },
            injectTo: 'head',
          },
        ]
      },
    },
  ],
})
