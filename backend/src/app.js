import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import { estaConectada } from './config/database.js'
import { env } from './config/env.js'
import { documentacion } from './docs/openapi.js'
import { manejarErrores, rutaNoEncontrada } from './middlewares/manejarErrores.js'
import { registrarPeticiones } from './middlewares/registrarPeticiones.js'

/**
 * Aplicación Express. El orden de los middlewares importa: cada petición los
 * recorre de arriba hacia abajo, y el manejo de errores va al final.
 */
export const app = express()

app.disable('x-powered-by')

app.use(registrarPeticiones)
app.use(helmet())

// Solo el frontend autorizado puede consumir la API desde un navegador
app.use(cors({ origin: env.corsOrigenes }))

// El límite evita que un cuerpo enorme ocupe la memoria del servidor
app.use(express.json({ limit: '100kb' }))

app.get('/api/docs.json', (_req, res) => res.json(documentacion))
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(documentacion, {
  customSiteTitle: 'API ConectaTutor Uniguajira',
}))

app.get('/api/salud', (_req, res) => {
  res.status(200).json({
    estado: 'ok',
    baseDeDatos: estaConectada() ? 'conectada' : 'desconectada',
    fecha: new Date().toISOString(),
  })
})

// Después de todas las rutas: lo que nadie respondió es un 404, y cualquier error termina aquí
app.use(rutaNoEncontrada)
app.use(manejarErrores)
