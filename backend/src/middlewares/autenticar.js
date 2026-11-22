import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Usuario } from '../models/index.js'
import { ALGORITMO_TOKEN, firmarToken, PREFIJO_SESION_CERRADA } from '../services/auth.service.js'
import { HttpError } from '../utils/HttpError.js'

/** Encabezado con el que la API entrega el token renovado tras cada uso. */
export const ENCABEZADO_TOKEN_RENOVADO = 'X-Token-Renovado'

/** Motivo del 401 cuando la cuenta ingresó en otro lugar: el cliente lo explica en vez de hablar de expiración. */
export const SESION_REEMPLAZADA = 'SESION_REEMPLAZADA'

/**
 * Encabezado que marca una consulta automática (la campana cada minuto). Esa consulta
 * no es uso de la persona: responde, pero no renueva el token (RQNF005).
 */
export const ENCABEZADO_CONSULTA_AUTOMATICA = 'X-Consulta-Automatica'

/** Segundos mínimos entre renovaciones, para no firmar un token por cada petición seguida. */
const SEGUNDOS_ENTRE_RENOVACIONES = 60

/**
 * Lee el token del encabezado `Authorization: Bearer <token>`, comprueba la
 * firma y la caducidad, y devuelve el usuario al que pertenece.
 * Como el token vence tras un rato sin uso (RQNF005), cada petición válida
 * devuelve uno renovado en `X-Token-Renovado`, con el mismo inicio de sesión,
 * salvo las consultas automáticas, que no cuentan como uso.
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
  const usuario = await Usuario.findById(contenido.sub).select('+sesionActiva')
  if (!usuario) {
    throw new HttpError(401, 'La sesión no es válida. Inicia sesión de nuevo')
  }
  // La persona pulsó Salir: el token de esa sesión ya no sirve aunque alguien guarde una copia.
  if (usuario.sesionActiva?.startsWith(PREFIJO_SESION_CERRADA)) {
    throw new HttpError(401, 'Tu sesión se cerró. Inicia sesión de nuevo')
  }
  // Solo una sesión a la vez: si la cuenta ingresó en otro lado, este token ya no sirve.
  if (usuario.sesionActiva && contenido.sid !== usuario.sesionActiva) {
    throw new HttpError(401, 'Tu cuenta se abrió en otro navegador o dispositivo. Inicia sesión de nuevo', undefined, SESION_REEMPLAZADA)
  }

  req.sesionId = contenido.sid ?? null
  const ahora = Math.floor(Date.now() / 1000)
  // Solo el uso de la persona renueva: una pestaña abandonada con la campana abierta vence igual.
  const automatica = req.get(ENCABEZADO_CONSULTA_AUTOMATICA) === '1'
  if (!automatica && ahora - contenido.iat >= SEGUNDOS_ENTRE_RENOVACIONES) {
    res.set(ENCABEZADO_TOKEN_RENOVADO, firmarToken(usuario, contenido.ini ?? contenido.iat, contenido.sid))
  }
  return usuario
}

/**
 * Exige una sesión activa (RQNF005) y deja al usuario en `req.usuario`
 * para las rutas que siguen.
 */
export async function autenticar(req, res, next) {
  req.usuario = await usuarioDelToken(req, res)
  // Cuenta creada por Coordinación sin activar: puede consultar, pero no cambiar nada
  // hasta crear su contraseña y aceptar el tratamiento de datos.
  if (req.usuario.primerAccesoPendiente && req.method !== 'GET' && !RUTAS_SIN_ACTIVAR.has(req.originalUrl.split('?')[0])) {
    throw new HttpError(403, 'Antes de continuar crea tu contraseña y acepta el tratamiento de tus datos', undefined, 'PRIMER_ACCESO')
  }
  next()
}

/** Rutas que cambian datos permitidas a una cuenta sin activar: activarla o salir. */
const RUTAS_SIN_ACTIVAR = new Set(['/api/auth/yo/primer-acceso', '/api/auth/salida'])

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
