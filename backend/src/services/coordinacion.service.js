import { INSTITUCION } from '../config/institucion.js'
import { PerfilTutor, Sesion } from '../models/index.js'
import { EstadoSesion, EstadoVerificacion } from '../utils/enums.js'
import { HttpError } from '../utils/HttpError.js'
import { calcularEstadisticas, presentarPerfil } from './tutores.service.js'

// Coordinación (administrador): verificación de tutores (RQF021) y cifras agregadas.

const DATOS_DEL_PERFIL = [
  { path: 'estudiante', populate: { path: 'programa' } },
  { path: 'materias', populate: { path: 'programa' } },
]

/** Lo que ve la coordinación de un perfil: lo del dueño más el correo para poder contactarlo. */
async function presentarParaCoordinacion(perfil) {
  await perfil.populate(DATOS_DEL_PERFIL)
  const estadisticas = await calcularEstadisticas([perfil._id])
  const salida = presentarPerfil(perfil, estadisticas.get(perfil.id), { propio: true })
  salida.estudiante.correoInstitucional = perfil.estudiante.correoInstitucional
  return salida
}

/**
 * Lista los perfiles de tutor en un estado de verificación, los más antiguos primero.
 * @param {string} estado Valor de EstadoVerificacion.
 */
export async function listarPerfiles(estado) {
  const perfiles = await PerfilTutor.find({ estadoVerificacion: estado }).sort({ updatedAt: 1 })
  return Promise.all(perfiles.map(presentarParaCoordinacion))
}

/**
 * Verifica un perfil de tutor: desde ese momento aparece en la búsqueda.
 * Exige que el perfil esté completo, porque un tutor sin materias o sin
 * horario no puede recibir solicitudes.
 */
export async function verificarPerfil(id) {
  const perfil = await PerfilTutor.findById(id)
  if (!perfil) throw new HttpError(404, 'El perfil de tutor no existe')
  if (perfil.estadoVerificacion === EstadoVerificacion.VERIFICADO) {
    throw new HttpError(409, 'El perfil ya está verificado')
  }
  if (perfil.materias.length === 0 || perfil.disponibilidad.length === 0) {
    throw new HttpError(409, 'El perfil está incompleto: necesita al menos una materia y una franja de disponibilidad')
  }
  perfil.estadoVerificacion = EstadoVerificacion.VERIFICADO
  perfil.motivoRechazo = null
  await perfil.save()
  return presentarParaCoordinacion(perfil)
}

/** Rechaza un perfil (o retira una verificación) dejando el motivo para el estudiante. */
export async function rechazarPerfil(id, motivo) {
  const perfil = await PerfilTutor.findById(id)
  if (!perfil) throw new HttpError(404, 'El perfil de tutor no existe')
  if (perfil.estadoVerificacion === EstadoVerificacion.RECHAZADO) {
    throw new HttpError(409, 'El perfil ya está rechazado')
  }
  perfil.estadoVerificacion = EstadoVerificacion.RECHAZADO
  perfil.motivoRechazo = motivo
  await perfil.save()
  return presentarParaCoordinacion(perfil)
}

const CLAVE_POR_ESTADO = Object.freeze({
  [EstadoSesion.PENDIENTE]: 'pendientes',
  [EstadoSesion.CONFIRMADA]: 'confirmadas',
  [EstadoSesion.FINALIZADA]: 'finalizadas',
  [EstadoSesion.RECHAZADA]: 'rechazadas',
  [EstadoSesion.CANCELADA]: 'canceladas',
})

function filaVacia() {
  return {
    solicitudes: 0, pendientes: 0, confirmadas: 0, finalizadas: 0, rechazadas: 0, canceladas: 0,
    estudiantesAtendidos: 0, tutoresVerificados: 0, tutoresPendientes: 0, calificacionPromedio: null,
    atendidos: new Set(), puntajes: [],
  }
}

/**
 * Calcula las cifras de uso por sede y en total. Son agregados: no sale
 * ningún nombre ni dato de una persona.
 * @returns {Promise<{porSede: object, total: object}>}
 */
export async function calcularMetricas() {
  const [sesiones, perfiles] = await Promise.all([
    Sesion.find().select('estado calificacion solicitante').populate('solicitante', 'tipo sede'),
    PerfilTutor.find().select('estadoVerificacion estudiante').populate('estudiante', 'tipo sede'),
  ])

  const porSede = Object.fromEntries(INSTITUCION.sedes.map((sede) => [sede, filaVacia()]))
  const total = filaVacia()
  const filasDe = (sede) => [total, porSede[sede]].filter(Boolean)

  for (const sesion of sesiones) {
    for (const fila of filasDe(sesion.solicitante?.sede)) {
      fila.solicitudes += 1
      fila[CLAVE_POR_ESTADO[sesion.estado]] += 1
      if (sesion.estado === EstadoSesion.FINALIZADA) fila.atendidos.add(String(sesion.solicitante?._id))
      if (sesion.calificacion) fila.puntajes.push(sesion.calificacion.puntaje)
    }
  }
  for (const perfil of perfiles) {
    for (const fila of filasDe(perfil.estudiante?.sede)) {
      if (perfil.estadoVerificacion === EstadoVerificacion.VERIFICADO) fila.tutoresVerificados += 1
      if (perfil.estadoVerificacion === EstadoVerificacion.PENDIENTE) fila.tutoresPendientes += 1
    }
  }
  for (const fila of [total, ...Object.values(porSede)]) {
    fila.estudiantesAtendidos = fila.atendidos.size
    fila.calificacionPromedio = fila.puntajes.length > 0
      ? Math.round((fila.puntajes.reduce((suma, puntaje) => suma + puntaje, 0) / fila.puntajes.length) * 10) / 10
      : null
    delete fila.atendidos
    delete fila.puntajes
  }
  return { porSede, total }
}
