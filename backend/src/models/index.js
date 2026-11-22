import { Materia } from './materia.model.js'
import { Notificacion } from './notificacion.model.js'
import { PerfilTutor, prepararAprobaciones } from './perfilTutor.model.js'
import { Programa } from './programa.model.js'
import { prepararReservas, Sesion } from './sesion.model.js'
import { Administrador, Estudiante, Usuario } from './usuario.model.js'

export { Administrador, Estudiante, Materia, Notificacion, PerfilTutor, Programa, Sesion, Usuario }

/**
 * Espera a que MongoDB termine de crear los índices de todas las colecciones.
 * Se llama antes de atender peticiones: los índices únicos (correo, código de
 * materia, franja ocupada) son los que impiden duplicados y dobles reservas.
 */
export async function asegurarIndices() {
  await Promise.all([Usuario, Programa, Materia, PerfilTutor, Sesion, Notificacion].map((modelo) => modelo.init()))
  await prepararReservas()
  await prepararAprobaciones()
}
