// Resuelve la pantalla inicial de cada rol y de los invitados.
import { matchPath } from 'react-router-dom'
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

const RUTAS_ADMINISTRADOR = ['/admin/verificacion', '/admin/perfil', '/admin/materias', '/admin/reportes', '/admin/cuentas']
const RUTAS_ESTUDIANTE = ['/', '/tutores', '/tutores/:id', '/tutores/:id/solicitar', '/sesiones', '/sesiones/:id', '/sesiones/:id/calificar',
  '/sesiones/:id/promedio', '/sesiones/:id/reprogramar', '/notificaciones', '/solicitudes', '/perfil', '/favoritos', '/reportar']

/**
 * Comprueba que el destino conservado al pedir el ingreso pertenezca a las rutas del rol.
 * @param {unknown} destino Ruta conservada.
 * @param {import('../modelo/Usuario.js').default} usuario Usuario autenticado.
 * @returns {boolean} Verdadero si la ruta está permitida.
 */
export function destinoPermitido(destino, usuario) {
  if (typeof destino !== 'string') return false
  const rutaDestino = destino.split('?')[0]
  if (usuario.getRol() === RolUsuario.ADMINISTRADOR) return RUTAS_ADMINISTRADOR.includes(rutaDestino)
  if (usuario.getRol() !== RolUsuario.ESTUDIANTE) return false
  return RUTAS_ESTUDIANTE.some((ruta) => matchPath({ path: ruta, end: true }, rutaDestino))
}

/**
 * Indica si el visitante llegó al ingreso desde «Solicitar tutoría».
 * @param {unknown} destino Ruta conservada.
 * @returns {boolean} Verdadero si iba a solicitar una tutoría.
 */
export function vieneDeSolicitud(destino) {
  return typeof destino === 'string' && Boolean(matchPath({ path: '/tutores/:id/solicitar', end: true }, destino.split('?')[0]))
}
