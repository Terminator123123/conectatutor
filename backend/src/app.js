import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import { estaConectada } from './config/database.js'
import { env } from './config/env.js'
import { documentacion } from './docs/openapi.js'
import { cerrarEnProduccion } from './middlewares/cerrarEnProduccion.js'
import { ENCABEZADO_TOKEN_RENOVADO } from './middlewares/autenticar.js'
import { manejarErrores, rutaNoEncontrada } from './middlewares/manejarErrores.js'
import { registrarPeticiones } from './middlewares/registrarPeticiones.js'
import { authRouter, usuariosRouter } from './routes/auth.routes.js'
import { facultadesRouter, materiasRouter, programasRouter } from './routes/catalogo.routes.js'
import { coordinacionRouter } from './routes/coordinacion.routes.js'
import { favoritosRouter } from './routes/favoritos.routes.js'
import { sesionesRouter } from './routes/sesiones.routes.js'
import { notificacionesRouter } from './routes/notificaciones.routes.js'
import { tutoresRouter } from './routes/tutores.routes.js'

/**
 * Aplicación Express. El orden de los middlewares importa: cada petición los
 * recorre de arriba hacia abajo, y el manejo de errores va al final.
 */
export const app = express()

app.disable('x-powered-by')
// Sin ETag: un 304 haría que el navegador reutilice encabezados guardados, como un X-Token-Renovado viejo
app.set('etag', false)

// En producción la API está detrás del proxy de la plataforma: así req.ip es la dirección real del cliente.
if (env.esProduccion) app.set('trust proxy', 1)

app.use(registrarPeticiones)
app.use(helmet())

// Solo el frontend autorizado puede consumir la API desde un navegador
app.use(cors({ origin: env.corsOrigenes, exposedHeaders: [ENCABEZADO_TOKEN_RENOVADO] }))

// El registro abierto es solo para desarrollo y pruebas: en producción no existe, ni con un cuerpo mal formado
app.post('/api/auth/registro', cerrarEnProduccion())

// El límite evita que un cuerpo enorme ocupe la memoria del servidor
// La foto de perfil llega en base64 (máximo 200 KB de imagen): esa ruta admite un cuerpo mayor.
app.use('/api/auth/yo/foto', express.json({ limit: '300kb' }))
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

app.use('/api/auth', authRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/facultades', facultadesRouter)
app.use('/api/programas', programasRouter)
app.use('/api/materias', materiasRouter)
app.use('/api/tutores', tutoresRouter)
app.use('/api/sesiones', sesionesRouter)
app.use('/api/notificaciones', notificacionesRouter)
app.use('/api/favoritos', favoritosRouter)
app.use('/api/coordinacion', coordinacionRouter)

// Después de todas las rutas: lo que nadie respondió es un 404, y cualquier error termina aquí
app.use(rutaNoEncontrada)
app.use(manejarErrores)
