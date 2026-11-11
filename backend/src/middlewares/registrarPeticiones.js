import { env } from '../config/env.js'

/**
 * Muestra en consola cada petición con su código de respuesta y duración.
 * Nunca registra el cuerpo ni los encabezados: ahí viajan contraseñas y tokens.
 */
export function registrarPeticiones(req, res, next) {
  if (env.esPrueba) {
    next()
    return
  }
  const inicio = process.hrtime.bigint()
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6
    // Solo la ruta, sin la cadena de consulta, para no dejar datos personales en el registro.
    const ruta = req.originalUrl.split('?')[0]
    console.log(`[API] ${req.method} ${ruta} -> ${res.statusCode} (${ms.toFixed(0)} ms)`)
  })
  next()
}
