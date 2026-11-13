import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Usuario } from '../models/index.js'
import { ALGORITMO_TOKEN, firmarToken } from '../services/auth.service.js'
import { HttpError } from '../utils/HttpError.js'

/** Encabezado con el que la API entrega el token renovado tras cada uso. */
export const ENCABEZADO_TOKEN_RENOVADO = 'X-Token-Renovado'

/** Segundos mínimos entre renovaciones, para no firmar un token por cada petición seguida. */
const SEGUNDOS_ENTRE_RENOVACIONES = 60

/**
 * Lee el token del encabezado `Authorization: Bearer <token>`, comprueba la
 * firma y la caducidad, y devuelve el usuario al que pertenece.
 * Como el token vence tras un rato sin uso (RQNF005), cada petición válida
 * devuelve uno renovado en `X-Token-Renovado`, con el mismo inicio de sesión.
 * @returns {Promise<import('mongoose').Document>}
 */
async function usuarioDelToken(req, res) {
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

  const ahora = Math.floor(Date.now() / 1000)
  if (ahora - contenido.iat >= SEGUNDOS_ENTRE_RENOVACIONES) {
    res.set(ENCABEZADO_TOKEN_RENOVADO, firmarToken(usuario, contenido.ini ?? contenido.iat))
  }
  return usuario
}

/**
 * Exige una sesión activa (RQNF005) y deja al usuario en `req.usuario`
 * para las rutas que siguen.
 */
export async function autenticar(req, res, next) {
  req.usuario = await usuarioDelToken(req, res)
  next()
}

/**
 * Para rutas públicas que muestran algo más a quien tiene sesión: si llega un
 * token se valida igual que en `autenticar`; si no llega, la petición sigue sin usuario.
 */
export async function autenticarSiHayToken(req, res, next) {
  if (req.get('authorization')) {
    req.usuario = await usuarioDelToken(req, res)
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
