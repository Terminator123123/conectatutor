import { randomBytes } from 'node:crypto'
import dotenv from 'dotenv'

if (process.env.NODE_ENV !== 'test') dotenv.config({ quiet: true })

const entorno = process.env.NODE_ENV ?? 'development'
const esProduccion = entorno === 'production'

/** Longitud mínima del secreto con el que se firman los tokens. */
const LONGITUD_MINIMA_SECRETO = 32

const SEGUNDOS_POR_UNIDAD = { s: 1, m: 60, h: 3600, d: 86400 }

/**
 * Convierte una duración como "30m", "2h", "1d" o "90" (segundos) a segundos.
 * @returns {number} Segundos; NaN si el texto no es una duración válida.
 */
export function aSegundos(texto) {
  const partes = /^(\d+)\s*([smhd])?$/i.exec(String(texto).trim())
  if (!partes) return Number.NaN
  return Number(partes[1]) * SEGUNDOS_POR_UNIDAD[(partes[2] ?? 's').toLowerCase()]
}

/** Única fuente de configuración: el resto del código importa `env` y no lee process.env. */
export const env = Object.freeze({
  entorno,
  esProduccion,
  esPrueba: entorno === 'test',
  puerto: Number(process.env.PORT) || 3000,
  // Vacía en desarrollo: se usa una base temporal en memoria (ver config/database.js).
  mongodbUri: (process.env.MONGODB_URI ?? '').trim(),
  // Admite varios orígenes separados por coma
  corsOrigenes: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean),
  claveDemo: process.env.CLAVE_DEMO ?? '',
  // Secreto con el que se firman los tokens. En desarrollo, si no se define, se genera
  // uno al azar en cada arranque (los tokens anteriores dejan de servir al reiniciar).
  jwtSecreto: (process.env.JWT_SECRETO ?? '').trim() || (esProduccion ? '' : randomBytes(48).toString('hex')),
  // Tope absoluto de una sesión, aunque haya actividad: "2h", "30m"...
  jwtDuracion: (process.env.JWT_DURACION ?? '').trim() || '2h',
  // Tiempo sin usar la aplicación tras el cual la sesión expira (RQNF005): "30m", "15m"...
  sesionInactividad: (process.env.SESION_INACTIVIDAD ?? '').trim() || '30m',
  // Dirección del frontend para armar el enlace de recuperación de acceso.
  urlFrontend: ((process.env.FRONTEND_URL ?? '').trim() || (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',')[0].trim()).replace(/\/$/, ''),
  // Correo de salida (Gmail con contraseña de aplicación). Vacío: el enlace se escribe en la consola.
  correo: Object.freeze({
    usuario: (process.env.CORREO_USUARIO ?? '').trim(),
    claveApp: (process.env.CORREO_CLAVE_APP ?? '').replace(/\s/g, ''),
    remitente: (process.env.CORREO_REMITENTE ?? '').trim() || 'ConectaTutor Uniguajira',
    // Solo para demostraciones: todos los correos van a esta dirección en lugar del destinatario real.
    desvio: (process.env.CORREO_DESVIO ?? '').trim(),
  }),
})

/**
 * Comprueba que la configuración sirva para arrancar.
 * @returns {string[]} Lista de problemas; vacía si todo está bien.
 */
export function revisarConfiguracion() {
  const problemas = []
  if (env.esProduccion && !env.mongodbUri) {
    problemas.push('Falta MONGODB_URI: en producción la base de datos es obligatoria.')
  }
  if (env.esProduccion && env.corsOrigenes.includes('*')) {
    problemas.push('CORS_ORIGIN no puede ser * en producción: indica el dominio del frontend.')
  }
  if (env.jwtSecreto.length < LONGITUD_MINIMA_SECRETO) {
    problemas.push(`JWT_SECRETO debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres al azar.`)
  }
  for (const [nombre, valor] of [['JWT_DURACION', env.jwtDuracion], ['SESION_INACTIVIDAD', env.sesionInactividad]]) {
    if (!(aSegundos(valor) > 0)) problemas.push(`${nombre} debe ser una duración como 30m, 2h o 1d.`)
  }
  return problemas
}
