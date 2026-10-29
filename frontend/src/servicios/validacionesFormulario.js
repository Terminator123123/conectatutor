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
