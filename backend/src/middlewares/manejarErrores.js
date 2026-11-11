import mongoose from 'mongoose'
import { HttpError } from '../utils/HttpError.js'

/**
 * Se ejecuta cuando ninguna ruta coincidió con la petición.
 * Debe registrarse DESPUÉS de todas las rutas.
 */
export function rutaNoEncontrada(req, _res, next) {
  next(new HttpError(404, `La ruta ${req.method} ${req.path} no existe`))
}

/** MongoDB lanza el código 11000 cuando se repite un valor que debe ser único. */
function esErrorClaveDuplicada(error) {
  return typeof error === 'object' && error !== null && error.code === 11000
}

/**
 * Middleware de manejo de errores. Express lo reconoce por sus 4 parámetros.
 * Convierte cualquier error en una respuesta JSON con el formato:
 *   { "mensaje": "...", "errores": ["..."] }
 * Debe registrarse al FINAL de app.js.
 */
export function manejarErrores(error, _req, res, _next) {
  // 1. Errores que lanza la propia API (400, 401, 403, 404, 409...)
  if (error instanceof HttpError) {
    res.status(error.status).json({ mensaje: error.message, errores: error.errores })
    return
  }

  // 2. JSON mal escrito en el cuerpo de la petición (lo detecta express.json)
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ mensaje: 'El cuerpo de la petición no es un JSON válido' })
    return
  }

  // 3. Cuerpo demasiado grande
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ mensaje: 'El cuerpo de la petición es demasiado grande' })
    return
  }

  // El cuerpo llegó con una codificación o compresión que la API no lee
  if (error?.type === 'charset.unsupported' || error?.type === 'encoding.unsupported') {
    res.status(415).json({ mensaje: 'El cuerpo debe enviarse como JSON en UTF-8 y sin una compresión no soportada' })
    return
  }

  // 4. Reglas del esquema de Mongoose que no se cumplen
  if (error instanceof mongoose.Error.ValidationError) {
    const errores = Object.values(error.errors).map((detalle) => detalle.message)
    res.status(400).json({ mensaje: 'Los datos enviados no son válidos', errores })
    return
  }

  // 5. Un valor no se pudo convertir al tipo esperado (por ejemplo, un id mal formado)
  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ mensaje: `El valor enviado en "${error.path}" no es válido` })
    return
  }

  // 6. Índice único violado: ya existe un registro con ese valor
  if (esErrorClaveDuplicada(error)) {
    const campo = Object.keys(error.keyPattern ?? {})[0]
    const mensaje = campo
      ? `Ya existe un registro con ese valor en "${campo}"`
      : 'Ya existe un registro con esos datos'
    res.status(409).json({ mensaje })
    return
  }

  // 7. Cualquier otro error: no se muestran detalles internos al cliente.
  console.error('[Error no controlado]', error)
  res.status(500).json({ mensaje: 'Error interno del servidor' })
}
