import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Usuario } from '../models/index.js'
import { ALGORITMO_TOKEN } from '../services/auth.service.js'
import { HttpError } from '../utils/HttpError.js'

/**
 * Lee el token del encabezado `Authorization: Bearer <token>`, comprueba la
 * firma y la caducidad, y devuelve el usuario al que pertenece.
 * @returns {Promise<import('mongoose').Document>}
 */
async function usuarioDelToken(req) {
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
  return usuario
}

/**
 * Exige una sesión activa (RQNF005) y deja al usuario en `req.usuario`
 * para las rutas que siguen.
 */
export async function autenticar(req, _res, next) {
  req.usuario = await usuarioDelToken(req)
  next()
}

/**
 * Para rutas públicas que muestran algo más a quien tiene sesión: si llega un
 * token se valida igual que en `autenticar`; si no llega, la petición sigue sin usuario.
 */
export async function autenticarSiHayToken(req, _res, next) {
  if (req.get('authorization')) {
    req.usuario = await usuarioDelToken(req)
  }
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
