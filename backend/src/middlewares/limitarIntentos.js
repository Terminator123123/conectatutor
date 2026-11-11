import { HttpError } from '../utils/HttpError.js'

// Freno a quien prueba contraseñas una tras otra: después de varios ingresos
// fallidos seguidos para el mismo correo desde la misma dirección, hay que esperar.
// Se lleva en memoria: suficiente para una sola instancia de la API.

const INTENTOS_MAXIMOS = 5
const VENTANA_MS = 15 * 60 * 1000
const REGISTROS_MAXIMOS = 10000

/** clave -> { fallos, vence } */
const intentos = new Map()

function claveDe(req) {
  const correo = typeof req.body?.correoInstitucional === 'string' ? req.body.correoInstitucional : ''
  return `${req.ip}|${correo}`
}

function limpiarVencidos(ahora) {
  for (const [clave, registro] of intentos) {
    if (registro.vence <= ahora) intentos.delete(clave)
  }
}

/** Corta la petición con 429 si ya se agotaron los intentos. Va después de validarIngreso. */
export function limitarIngreso(req, res, next) {
  const ahora = Date.now()
  const registro = intentos.get(claveDe(req))
  if (registro && registro.vence > ahora && registro.fallos >= INTENTOS_MAXIMOS) {
    const segundos = Math.ceil((registro.vence - ahora) / 1000)
    res.set('Retry-After', String(segundos))
    throw new HttpError(429, `Demasiados intentos fallidos. Espera ${Math.ceil(segundos / 60)} minutos e inténtalo de nuevo`)
  }
  next()
}

/** Anota un ingreso fallido. */
export function anotarIngresoFallido(req) {
  const ahora = Date.now()
  if (intentos.size >= REGISTROS_MAXIMOS) limpiarVencidos(ahora)
  if (intentos.size >= REGISTROS_MAXIMOS) intentos.clear()
  const clave = claveDe(req)
  const registro = intentos.get(clave)
  if (registro && registro.vence > ahora) {
    registro.fallos += 1
  } else {
    intentos.set(clave, { fallos: 1, vence: ahora + VENTANA_MS })
  }
}

/** Borra la cuenta de fallos tras un ingreso correcto. */
export function olvidarIngresosFallidos(req) {
  intentos.delete(claveDe(req))
}

/** Vacía el registro completo (lo usan las pruebas). */
export function reiniciarIntentos() {
  intentos.clear()
}
