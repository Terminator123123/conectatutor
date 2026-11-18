import { createHash, randomBytes } from 'node:crypto'
import { env } from '../config/env.js'
import { Usuario } from '../models/index.js'
import { cifrarClave } from '../utils/claves.js'
import { HttpError } from '../utils/HttpError.js'
import { correoDisponible, enviarCorreo } from './correo.service.js'

/** Minutos que dura un enlace de recuperación. */
export const MINUTOS_ENLACE = 30

const MENSAJE_ENLACE_INVALIDO = 'El enlace venció o ya se usó. Pide uno nuevo para continuar'

const hashDe = (token) => createHash('sha256').update(token).digest('hex')

/**
 * Pide un enlace de recuperación. Responde igual exista o no la cuenta,
 * para no revelar qué correos están registrados.
 * @param {string} correoInstitucional Correo ya validado y en minúsculas.
 */
export async function solicitarRecuperacion(correoInstitucional) {
  // Sin forma real de enviar el enlace (producción sin correo) no se genera ninguno.
  if (!correoDisponible()) {
    throw new HttpError(503, 'La recuperación por correo no está disponible por ahora. Pide ayuda a Coordinación de Bienestar')
  }
  const usuario = await Usuario.findOne({ correoInstitucional })
  if (!usuario) return
  const token = randomBytes(32).toString('base64url')
  await Usuario.updateOne({ _id: usuario._id }, {
    $set: { 'recuperacion.tokenHash': hashDe(token), 'recuperacion.vence': new Date(Date.now() + MINUTOS_ENLACE * 60000) },
  })
  const enlace = `${env.urlFrontend}/recuperar-acceso?token=${token}`
  const nombre = usuario.nombre.split(' ')[0]
  // No se espera el envío: así la respuesta es la misma exista o no la cuenta, y un fallo
  // del correo no revela que el correo está registrado. El error se anota sin el enlace.
  enviarCorreo({
    para: usuario.correoInstitucional,
    asunto: 'Restablece tu contraseña de ConectaTutor',
    texto: `Hola, ${nombre}.\n\nPara crear una contraseña nueva abre este enlace (vence en ${MINUTOS_ENLACE} minutos y sirve una sola vez):\n${enlace}\n\nSi no lo pediste, ignora este mensaje: tu contraseña sigue igual.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#03090f">
<h2 style="color:#01616c">Restablece tu contraseña</h2>
<p>Hola, ${nombre.replace(/[<>&"]/g, '')}.</p>
<p>Para crear una contraseña nueva en ConectaTutor pulsa el botón. El enlace vence en ${MINUTOS_ENLACE} minutos y sirve una sola vez.</p>
<p><a href="${enlace}" style="display:inline-block;background:#01616c;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Crear contraseña nueva</a></p>
<p style="color:#555;font-size:13px">Si no lo pediste, ignora este mensaje: tu contraseña sigue igual.</p></div>`,
  }).catch((error) => console.error(`[Correo] No se pudo enviar el enlace de recuperación: ${error.message}`))
}

async function usuarioDelToken(token) {
  if (typeof token !== 'string' || !token) throw new HttpError(400, MENSAJE_ENLACE_INVALIDO)
  const usuario = await Usuario.findOne({ 'recuperacion.tokenHash': hashDe(token), 'recuperacion.vence': { $gt: new Date() } })
  if (!usuario) throw new HttpError(400, MENSAJE_ENLACE_INVALIDO)
  return usuario
}

/** Comprueba que el enlace siga vigente, sin usarlo. */
export async function comprobarEnlace(token) {
  await usuarioDelToken(token)
}

/**
 * Cambia la contraseña con un enlace vigente. El enlace se consume en la misma escritura
 * que lo comprueba: si llegan varias peticiones a la vez con el mismo enlace, solo una gana.
 */
export async function restablecerClave(token, clave) {
  if (typeof token !== 'string' || !token) throw new HttpError(400, MENSAJE_ENLACE_INVALIDO)
  const claveHash = await cifrarClave(clave)
  const { modifiedCount } = await Usuario.updateOne(
    { 'recuperacion.tokenHash': hashDe(token), 'recuperacion.vence': { $gt: new Date() } },
    // Cambiar la contraseña por recuperación cierra cualquier sesión abierta.
    { $set: { claveHash, 'recuperacion.tokenHash': null, 'recuperacion.vence': null, sesionActiva: randomBytes(16).toString('hex') } },
  )
  if (modifiedCount !== 1) throw new HttpError(400, MENSAJE_ENLACE_INVALIDO)
}
