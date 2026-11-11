import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const entorno = process.env.NODE_ENV ?? 'development'

/** Única fuente de configuración: el resto del código importa `env` y no lee process.env. */
export const env = Object.freeze({
  entorno,
  esProduccion: entorno === 'production',
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
  return problemas
}
