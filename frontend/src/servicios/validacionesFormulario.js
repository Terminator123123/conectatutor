// Valida los campos compartidos de los formularios de autenticación.
import { servicioAutenticacion } from './instancias.js'

/** @param {string} nombre Nombre escrito. @returns {string} Error o texto vacío. */
export function validarNombre(nombre) {
  return nombre.replace(/\s/g, '').length >= 3 ? '' : 'Escribe tu nombre completo.'
}

/** @param {string} clave Contraseña escrita. @returns {string} Error o texto vacío. */
export function validarClave(clave) {
  return clave.length >= 8 && /\p{L}/u.test(clave) && /[0-9]/.test(clave)
    ? '' : 'La contraseña debe tener al menos 8 caracteres, con letras y números.'
}

/**
 * @param {string} confirmacion Contraseña repetida.
 * @param {string} clave Contraseña original.
 * @returns {string} Error o texto vacío.
 */
export function validarConfirmacion(confirmacion, clave) {
  return confirmacion === clave ? '' : 'Las contraseñas no coinciden.'
}

/**
 * @param {string} correo Correo escrito.
 * @param {string} dominioCorreo Dominio mostrado en el mensaje.
 * @returns {string} Error o texto vacío, delegando R8 en el servicio.
 */
export function validarCorreo(correo, dominioCorreo) {
  return servicioAutenticacion.validarCorreoInstitucional(correo)
    ? '' : `Usa tu correo institucional (@${dominioCorreo}).`
}

/**
 * Compara la confirmación con la contraseña desde la primera letra escrita.
 * Mientras lo escrito va coincidiendo con el inicio de la contraseña no marca error.
 * @param {string} confirmacion Texto del campo de confirmación.
 * @param {string} clave Contraseña escrita.
 * @param {boolean} [tocado=false] Si el campo ya perdió el foco o se intentó enviar.
 * @returns {{error: string, ayuda: string}} Mensaje para el campo.
 */
export function estadoConfirmacion(confirmacion, clave, tocado = false) {
  if (!confirmacion) return { error: tocado ? 'Confirma tu contraseña.' : '', ayuda: '' }
  if (confirmacion === clave) return { error: '', ayuda: '✓ Las contraseñas coinciden.' }
  if (!tocado && clave.startsWith(confirmacion)) return { error: '', ayuda: 'Va coincidiendo…' }
  return { error: 'Las contraseñas no coinciden.', ayuda: '' }
}
