import { randomBytes } from 'node:crypto'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const entorno = process.env.NODE_ENV ?? 'development'
const esProduccion = entorno === 'production'

/** Longitud mínima del secreto con el que se firman los tokens. */
const LONGITUD_MINIMA_SECRETO = 32

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
  // Cuánto dura una sesión antes de pedir el ingreso de nuevo: "2h", "30m"...
  jwtDuracion: (process.env.JWT_DURACION ?? '').trim() || '2h',
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
  return problemas
}
