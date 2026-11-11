import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Usuario } from '../models/index.js'
import { ALGORITMO_TOKEN } from '../services/auth.service.js'
import { HttpError } from '../utils/HttpError.js'

/**
 * Exige una sesión activa (RQNF005).
 * Lee el encabezado `Authorization: Bearer <token>`, comprueba la firma y la
 * caducidad del token y deja al usuario en `req.usuario` para las rutas que siguen.
 */
export async function autenticar(req, _res, next) {
  const encabezado = req.get('authorization') ?? ''
  const [esquema, token] = encabezado.split(' ')
  if (esquema !== 'Bearer' || !token) {
    throw new HttpError(401, 'Debes iniciar sesión para usar esta ruta')
  }

  let contenido
  try {
    contenido = jwt.verify(token, env.jwtSecreto, { algorithms: [ALGORITMO_TOKEN] })
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new HttpError(401, 'Tu sesión expiró. Inicia sesión de nuevo')
    }
    throw new HttpError(401, 'La sesión no es válida. Inicia sesión de nuevo')
  }

  // Se consulta la base en cada petición: si la cuenta ya no existe, el token deja de servir.
  const usuario = await Usuario.findById(contenido.sub)
  if (!usuario) {
    throw new HttpError(401, 'La sesión no es válida. Inicia sesión de nuevo')
  }

  req.usuario = usuario
  next()
}

/**
 * Exige que el usuario autenticado tenga uno de los roles indicados.
 * Va siempre DESPUÉS de `autenticar`.
 * @param {...string} roles Valores de RolUsuario.
 */
export function exigirRol(...roles) {
  return function comprobarRol(req, _res, next) {
    if (!req.usuario || !roles.includes(req.usuario.tipo)) {
      throw new HttpError(403, 'No tienes permiso para realizar esta acción')
    }
    next()
  }
}
