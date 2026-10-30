// Resuelve la pantalla inicial de cada rol y de los invitados.
import { RolUsuario } from '../modelo/enums.js'

/**
 * Resuelve la ruta inicial según el rol del usuario autenticado.
 * @param {import('../modelo/Usuario.js').default|null} usuario Usuario actual.
 * @returns {string} Ruta inicial del rol o inicio público.
 */
export function rutaInicialDe(usuario) {
  if (usuario?.getRol() === RolUsuario.ADMINISTRADOR) return '/admin/verificacion'
  if (usuario?.getRol() === RolUsuario.ESTUDIANTE) return '/tutores'
  return '/'
}
