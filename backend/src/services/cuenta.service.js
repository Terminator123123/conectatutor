import { Usuario } from '../models/index.js'
import { cifrarClave, compararClave } from '../utils/claves.js'
import { HttpError } from '../utils/HttpError.js'

/** Tamaño máximo de la foto ya reducida en el navegador. */
export const BYTES_MAXIMOS_FOTO = 200 * 1024

/**
 * Cambia la contraseña desde la cuenta, pidiendo la actual.
 * Responde 400 (no 401) si la actual no coincide: la sesión sigue siendo válida.
 */
export async function cambiarClave(usuarioId, claveActual, claveNueva) {
  const usuario = await Usuario.findById(usuarioId).select('+claveHash')
  if (!usuario || !(await compararClave(claveActual, usuario.claveHash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta')
  }
  // Un enlace de recuperación pedido antes deja de servir: ya no podría pisar la contraseña nueva.
  // Solo se escribe si la contraseña sigue siendo la que se comprobó: si entretanto cambió (otro cambio
  // de la cuenta o un restablecimiento por recuperación), este cambio ya no está autorizado y no la pisa.
  const { modifiedCount } = await Usuario.updateOne({ _id: usuario._id, claveHash: usuario.claveHash }, {
    $set: { claveHash: await cifrarClave(claveNueva), 'recuperacion.tokenHash': null, 'recuperacion.vence': null },
  })
  if (modifiedCount !== 1) {
    throw new HttpError(409, 'Tu contraseña cambió mientras se guardaba este cambio, así que este no se aplicó. Usa la contraseña más reciente')
  }
}

/**
 * Completa el primer acceso de una cuenta creada por Coordinación: contraseña propia (distinta
 * del documento), uso elegido y consentimiento. Se hace una sola vez.
 */
export async function completarPrimerAcceso(usuarioId, { claveNueva, quiereSerTutor }) {
  const usuario = await Usuario.findById(usuarioId).select('+claveHash')
  if (!usuario?.primerAccesoPendiente) throw new HttpError(409, 'Tu cuenta ya está activada')
  if (await compararClave(claveNueva, usuario.claveHash)) {
    throw new HttpError(400, 'La contraseña nueva no puede ser tu documento de identidad')
  }
  // Con el modelo de la subclase (Estudiante): quiereSerTutor no existe en el Usuario base.
  const { modifiedCount } = await usuario.constructor.updateOne({ _id: usuario._id, primerAccesoPendiente: true, claveHash: usuario.claveHash }, {
    $set: {
      claveHash: await cifrarClave(claveNueva), primerAccesoPendiente: false, quiereSerTutor,
      consentimientoDatos: { aceptado: true, fecha: new Date() },
      'recuperacion.tokenHash': null, 'recuperacion.vence': null,
    },
  })
  if (modifiedCount !== 1) {
    // Otra petición se adelantó: se dice cuál. Sin activar, solo una recuperación puede cambiar la contraseña.
    const actual = await Usuario.findById(usuario._id)
    if (!actual?.primerAccesoPendiente) throw new HttpError(409, 'Tu cuenta ya está activada')
    throw new HttpError(409, 'Tu contraseña se restableció con un enlace de recuperación mientras activabas la cuenta. Ingresa con la contraseña nueva para terminar la activación')
  }
}

/**
 * Reconoce el formato por los primeros bytes del archivo, no por lo que diga el cliente.
 * @returns {string|null} Tipo MIME admitido o null.
 */
function tipoDeImagen(datos) {
  if (datos.length > 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) return 'image/jpeg'
  if (datos.length > 8 && datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (datos.length > 12 && datos.toString('ascii', 0, 4) === 'RIFF' && datos.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

/**
 * Guarda la foto de perfil enviada como data URL (JPEG, PNG o WebP, máximo 200 KB).
 * @param {string} imagen `data:image/...;base64,...`
 */
export async function guardarFoto(usuarioId, imagen) {
  const partes = typeof imagen === 'string' ? /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(imagen) : null
  if (!partes) throw new HttpError(400, 'Envía la foto como imagen JPG, PNG o WebP')
  const datos = Buffer.from(partes[1], 'base64')
  if (datos.length > BYTES_MAXIMOS_FOTO) throw new HttpError(400, 'La foto pesa demasiado: máximo 200 KB')
  const tipo = tipoDeImagen(datos)
  if (!tipo) throw new HttpError(400, 'El archivo no es una imagen JPG, PNG o WebP')
  await Usuario.updateOne({ _id: usuarioId }, { $set: { 'foto.datos': datos, 'foto.tipo': tipo, 'foto.actualizada': new Date() } })
}

/** Quita la foto de perfil. */
export async function quitarFoto(usuarioId) {
  await Usuario.updateOne({ _id: usuarioId }, { $set: { 'foto.datos': null, 'foto.tipo': null, 'foto.actualizada': null } })
}

/** @returns {Promise<{datos: Buffer, tipo: string, actualizada: Date}|null>} Foto de un usuario, si tiene. */
export async function obtenerFoto(usuarioId) {
  const usuario = await Usuario.findById(usuarioId).select('+foto.datos +foto.tipo')
  if (!usuario) throw new HttpError(404, 'El usuario no existe')
  return usuario.foto?.datos ? usuario.foto : null
}
