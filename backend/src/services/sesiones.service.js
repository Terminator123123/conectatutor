import { franjasSonIguales, minutosDeFranja } from '../models/franja.schema.js'
import { Materia, PerfilTutor, Sesion } from '../models/index.js'
import { ESTADOS_QUE_OCUPAN_FRANJA, EstadoSesion, EstadoVerificacion, RolUsuario } from '../utils/enums.js'
import { aFechaGuardada, aTextoDia, diaDeLaSemana, hoyEnColombia, momentoDeInicio } from '../utils/fechas.js'
import { HttpError } from '../utils/HttpError.js'

// Sesiones de tutoría: solicitud (RQF012, RQF013), respuesta del tutor (RQF014),
// panel "Mis sesiones" (RQF015), cancelación (RQF016), calificación (RQF017),
// reprogramación (RQF028) y control de doble reserva (RQNF012).
// Aquí se validan en el servidor las reglas R1 a R7.

/** Con cuánta anticipación máxima se puede pedir una tutoría. */
const DIAS_MAXIMOS_DE_ANTICIPACION = 60

// Se pide también 'tipo': sin el discriminador Mongoose no reconoce al estudiante y descarta su sede.
const DATOS_DE_LA_PERSONA = 'tipo nombre correoInstitucional sede semestre programa'
const DATOS_DE_LA_SESION = [
  { path: 'solicitante', select: DATOS_DE_LA_PERSONA, populate: { path: 'programa' } },
  { path: 'tutor', populate: { path: 'estudiante', select: DATOS_DE_LA_PERSONA, populate: { path: 'programa' } } },
  { path: 'materia', select: 'codigo nombre' },
]

const MENSAJE_FRANJA_OCUPADA = 'Esa franja ya está reservada para ese día. Elige otra fecha u otra franja'

/** Error de una regla de negocio: 409 con el código de la regla incumplida. */
function errorDeRegla(regla, mensaje) {
  return new HttpError(409, mensaje, undefined, regla)
}

/** Papel de un usuario frente a una sesión. */
function papelDe(sesion, usuario) {
  if (sesion.solicitante?._id.equals(usuario._id)) return 'SOLICITANTE'
  if (sesion.tutor?.estudiante?._id.equals(usuario._id)) return 'TUTOR'
  if (usuario.tipo === RolUsuario.ADMINISTRADOR) return 'COORDINACION'
  return null
}

/**
 * Arma lo que la API muestra de una sesión a un usuario concreto.
 * El correo de la otra parte solo aparece cuando la sesión ya fue confirmada:
 * antes de eso nadie recibe datos de contacto de nadie.
 */
function presentarSesion(sesion, usuario) {
  const papel = papelDe(sesion, usuario)
  const esParticipante = papel === 'SOLICITANTE' || papel === 'TUTOR'
  const conContacto = esParticipante && [EstadoSesion.CONFIRMADA, EstadoSesion.FINALIZADA].includes(sesion.estado)
  const persona = (usuarioDeLaSesion) => usuarioDeLaSesion && {
    id: usuarioDeLaSesion.id,
    nombre: usuarioDeLaSesion.nombre,
    sede: usuarioDeLaSesion.sede,
    semestre: usuarioDeLaSesion.semestre,
    programa: usuarioDeLaSesion.programa,
    ...(conContacto ? { correoInstitucional: usuarioDeLaSesion.correoInstitucional } : {}),
  }
  return {
    id: sesion.id,
    miPapel: papel,
    solicitante: persona(sesion.solicitante),
    tutor: sesion.tutor && { id: sesion.tutor.id, tarifaHora: sesion.tutor.tarifaHora, estudiante: persona(sesion.tutor.estudiante) },
    materia: sesion.materia,
    fecha: aTextoDia(sesion.fecha),
    franja: sesion.franja,
    tema: sesion.tema,
    estado: sesion.estado,
    motivo: sesion.motivo,
    calificacion: sesion.calificacion,
    reprogramacion: sesion.reprogramacion && {
      propuestaPor: String(sesion.reprogramacion.propuestaPor),
      esMia: sesion.reprogramacion.propuestaPor.equals(usuario._id),
      fecha: aTextoDia(sesion.reprogramacion.fecha),
      franja: sesion.reprogramacion.franja,
      motivo: sesion.reprogramacion.motivo,
      propuestaEl: sesion.reprogramacion.propuestaEl,
    },
    createdAt: sesion.createdAt,
    updatedAt: sesion.updatedAt,
  }
}

/** Carga una sesión con sus datos relacionados o responde 404. */
async function cargarSesion(id) {
  const sesion = await Sesion.findById(id).populate(DATOS_DE_LA_SESION)
  if (!sesion) throw new HttpError(404, 'La sesión no existe')
  return sesion
}

/** Carga la sesión y exige que el usuario tenga uno de los papeles indicados; si no, 403. */
async function cargarSesionComo(id, usuario, papelesPermitidos) {
  const sesion = await cargarSesion(id)
  const papel = papelDe(sesion, usuario)
  if (!papelesPermitidos.includes(papel)) {
    throw new HttpError(403, 'No tienes permiso para realizar esta acción sobre la sesión')
  }
  return sesion
}

/**
 * Comprueba que una fecha y una franja sirvan para una tutoría con ese tutor:
 * la franja está en su disponibilidad (R3), la fecha cae en el día de la franja,
 * todavía no ha pasado y no está demasiado lejos.
 */
function exigirFranjaYFecha(perfil, dia, franja) {
  if (!perfil.disponibilidad.some((disponible) => franjasSonIguales(disponible, franja))) {
    throw errorDeRegla('R3', 'La franja solicitada no está disponible con este tutor')
  }
  const errores = []
  if (diaDeLaSemana(dia) !== franja.dia) {
    errores.push(`La fecha ${dia} no cae en ${franja.dia.toLowerCase()}, que es el día de la franja`)
  } else if (momentoDeInicio(dia, franja.horaInicio).getTime() <= Date.now()) {
    errores.push('La tutoría debe ser en una fecha y hora futuras')
  } else {
    const limite = new Date(Date.now() + DIAS_MAXIMOS_DE_ANTICIPACION * 24 * 60 * 60 * 1000)
    if (aFechaGuardada(dia) > limite) {
      errores.push(`La tutoría se puede pedir con máximo ${DIAS_MAXIMOS_DE_ANTICIPACION} días de anticipación`)
    }
  }
  if (errores.length > 0) throw new HttpError(400, 'La fecha de la tutoría no es válida', errores)
}

/**
 * Cambia el estado de una sesión solo si su estado actual lo permite (R5).
 * La comprobación y el cambio van en UNA sola operación de la base de datos:
 * si dos personas actúan a la vez (uno acepta y el otro cancela), solo gana una.
 */
async function cambiarEstado(id, estadosPermitidos, cambios) {
  const sesion = await Sesion.findOneAndUpdate(
    { _id: id, estado: { $in: estadosPermitidos } },
    { $set: { ...cambios, reprogramacion: null } },
    { returnDocument: 'after' },
  ).populate(DATOS_DE_LA_SESION)
  if (!sesion) {
    throw errorDeRegla('R5', 'El estado actual de la sesión no permite realizar esta acción')
  }
  return sesion
}

/**
 * Crea una solicitud de tutoría (RQF012, RQF013). Valida R1 a R4 y deja que el
 * índice único de la base de datos impida la doble reserva (RQNF012).
 * @param {import('mongoose').Document} usuario Estudiante que solicita.
 * @param {{tutor: string, materia: string, fecha: string, franja: object, tema: string}} datos
 */
export async function solicitar(usuario, { tutor, materia, fecha, franja, tema }) {
  const perfil = await PerfilTutor.findById(tutor)
  if (!perfil) throw new HttpError(404, 'El tutor no existe')

  if (perfil.estudiante.equals(usuario._id)) {
    throw errorDeRegla('R1', 'No puedes pedirte una tutoría a ti mismo')
  }
  if (perfil.estadoVerificacion !== EstadoVerificacion.VERIFICADO) {
    throw errorDeRegla('R4', 'Solo puedes solicitar tutorías a tutores verificados')
  }
  const ofreceLaMateria = perfil.materias.some((ofrecida) => ofrecida.equals(materia))
  if (!ofreceLaMateria || !(await Materia.exists({ _id: materia, activa: true }))) {
    throw errorDeRegla('R2', 'El tutor no ofrece la materia solicitada')
  }
  exigirFranjaYFecha(perfil, fecha, franja)

  let sesion
  try {
    sesion = await Sesion.create({
      solicitante: usuario._id,
      tutor: perfil._id,
      materia,
      fecha: aFechaGuardada(fecha),
      franja,
      tema,
    })
  } catch (error) {
    // El índice rechaza cualquier minuto compartido con otra reserva activa
    if (error?.code === 11000) throw new HttpError(409, MENSAJE_FRANJA_OCUPADA, undefined, 'RQNF012')
    throw error
  }
  return presentarSesion(await sesion.populate(DATOS_DE_LA_SESION), usuario)
}

/**
 * Lista las sesiones del usuario (RQF015): las que pidió y las que atiende como tutor.
 * El administrador ve todas.
 * @param {import('mongoose').Document} usuario
 * @param {{estado?: string, papel?: 'SOLICITANTE'|'TUTOR'}} filtros
 */
export async function listar(usuario, { estado, papel } = {}) {
  const filtro = {}
  if (estado) filtro.estado = estado

  if (usuario.tipo !== RolUsuario.ADMINISTRADOR) {
    const perfil = await PerfilTutor.findOne({ estudiante: usuario._id }).select('_id')
    const comoSolicitante = { solicitante: usuario._id }
    // Sin perfil de tutor no hay sesiones como tutor: un filtro que no coincide con nada.
    const comoTutor = { tutor: perfil ? perfil._id : null }
    if (papel === 'SOLICITANTE') Object.assign(filtro, comoSolicitante)
    else if (papel === 'TUTOR') Object.assign(filtro, comoTutor)
    else filtro.$or = [comoSolicitante, comoTutor]
  }

  const sesiones = await Sesion.find(filtro).populate(DATOS_DE_LA_SESION).sort({ fecha: -1, 'franja.horaInicio': -1 })
  return sesiones.map((sesion) => presentarSesion(sesion, usuario))
}

/** Devuelve una sesión a quien participa en ella o al administrador. */
export async function obtener(id, usuario) {
  const sesion = await cargarSesionComo(id, usuario, ['SOLICITANTE', 'TUTOR', 'COORDINACION'])
  return presentarSesion(sesion, usuario)
}

/** El tutor acepta la solicitud (RQF014): PENDIENTE -> CONFIRMADA. */
export async function confirmar(id, usuario) {
  await cargarSesionComo(id, usuario, ['TUTOR'])
  return presentarSesion(await cambiarEstado(id, [EstadoSesion.PENDIENTE], { estado: EstadoSesion.CONFIRMADA }), usuario)
}

/** El tutor rechaza la solicitud con un motivo (RQF014): PENDIENTE -> RECHAZADA. */
export async function rechazar(id, usuario, motivo) {
  await cargarSesionComo(id, usuario, ['TUTOR'])
  return presentarSesion(await cambiarEstado(id, [EstadoSesion.PENDIENTE], { estado: EstadoSesion.RECHAZADA, motivo }), usuario)
}

/** Cualquiera de las dos partes cancela con un motivo (RQF016): PENDIENTE o CONFIRMADA -> CANCELADA. */
export async function cancelar(id, usuario, motivo) {
  await cargarSesionComo(id, usuario, ['SOLICITANTE', 'TUTOR'])
  return presentarSesion(await cambiarEstado(id, ESTADOS_QUE_OCUPAN_FRANJA, { estado: EstadoSesion.CANCELADA, motivo }), usuario)
}

/** El tutor marca la tutoría como realizada: CONFIRMADA -> FINALIZADA. */
export async function finalizar(id, usuario) {
  await cargarSesionComo(id, usuario, ['TUTOR'])
  return presentarSesion(await cambiarEstado(id, [EstadoSesion.CONFIRMADA], { estado: EstadoSesion.FINALIZADA }), usuario)
}

/**
 * El solicitante califica la tutoría (RQF017).
 * R6: solo una sesión FINALIZADA y una sola vez. R7 (entero de 1 a 5) ya llega validado.
 */
export async function calificar(id, usuario, { puntaje, resena }) {
  await cargarSesionComo(id, usuario, ['SOLICITANTE'])
  const sesion = await Sesion.findOneAndUpdate(
    { _id: id, estado: EstadoSesion.FINALIZADA, calificacion: null },
    { $set: { calificacion: { puntaje, resena, fecha: new Date() } } },
    { returnDocument: 'after' },
  ).populate(DATOS_DE_LA_SESION)
  if (!sesion) throw errorDeRegla('R6', 'Solo puedes calificar una sesión finalizada y una sola vez')
  return presentarSesion(sesion, usuario)
}

/**
 * Una de las partes propone otra fecha y franja (RQF028). La sesión no cambia
 * hasta que la otra parte acepte.
 */
export async function proponerReprogramacion(id, usuario, { fecha, franja, motivo }) {
  const actual = await cargarSesionComo(id, usuario, ['SOLICITANTE', 'TUTOR'])
  if (aTextoDia(actual.fecha) === fecha && franjasSonIguales(actual.franja, franja)) {
    throw new HttpError(400, 'La propuesta debe cambiar la fecha o la franja de la sesión')
  }
  const perfil = await PerfilTutor.findById(actual.tutor._id)
  exigirFranjaYFecha(perfil, fecha, franja)

  const sesion = await Sesion.findOneAndUpdate(
    { _id: id, estado: { $in: ESTADOS_QUE_OCUPAN_FRANJA }, reprogramacion: null },
    { $set: { reprogramacion: { propuestaPor: usuario._id, fecha: aFechaGuardada(fecha), franja, motivo, propuestaEl: new Date() } } },
    { returnDocument: 'after' },
  ).populate(DATOS_DE_LA_SESION)
  if (!sesion) {
    if (ESTADOS_QUE_OCUPAN_FRANJA.includes(actual.estado)) {
      throw new HttpError(409, 'Ya hay una propuesta de reprogramación esperando respuesta')
    }
    throw errorDeRegla('R5', 'Solo se puede reprogramar una sesión pendiente o confirmada')
  }
  return presentarSesion(sesion, usuario)
}

/**
 * La otra parte acepta o rechaza la propuesta de reprogramación (RQF028).
 * Si acepta, la sesión pasa a la nueva fecha y franja; el índice único impide
 * que quede encima de otra reserva.
 */
export async function responderReprogramacion(id, usuario, acepta) {
  const actual = await cargarSesionComo(id, usuario, ['SOLICITANTE', 'TUTOR'])
  const propuesta = actual.reprogramacion
  if (!propuesta || !ESTADOS_QUE_OCUPAN_FRANJA.includes(actual.estado)) {
    throw new HttpError(409, 'La sesión no tiene una propuesta de reprogramación pendiente')
  }
  if (propuesta.propuestaPor.equals(usuario._id)) {
    throw new HttpError(403, 'La propuesta la responde la otra parte de la sesión')
  }

  const filtro = { _id: id, estado: { $in: ESTADOS_QUE_OCUPAN_FRANJA }, 'reprogramacion.propuestaEl': propuesta.propuestaEl }
  let cambios = { reprogramacion: null }
  if (acepta) {
    const perfil = await PerfilTutor.findById(actual.tutor._id)
    exigirFranjaYFecha(perfil, aTextoDia(propuesta.fecha), propuesta.franja)
    cambios = { fecha: propuesta.fecha, franja: propuesta.franja.toObject(), minutosOcupados: minutosDeFranja(propuesta.franja), reprogramacion: null }
  }

  let sesion
  try {
    sesion = await Sesion.findOneAndUpdate(filtro, { $set: cambios }, { returnDocument: 'after' }).populate(DATOS_DE_LA_SESION)
  } catch (error) {
    if (error?.code === 11000) throw new HttpError(409, MENSAJE_FRANJA_OCUPADA, undefined, 'RQNF012')
    throw error
  }
  if (!sesion) throw new HttpError(409, 'La propuesta de reprogramación ya no está vigente')
  return presentarSesion(sesion, usuario)
}

/**
 * Lista las franjas ya reservadas de un tutor desde hoy, para que el formulario
 * de solicitud no las ofrezca. Solo fecha y hora: nada sobre quién reservó.
 */
export async function listarOcupacion(perfilId) {
  const perfil = await PerfilTutor.findById(perfilId).select('estadoVerificacion')
  if (!perfil || perfil.estadoVerificacion !== EstadoVerificacion.VERIFICADO) {
    throw new HttpError(404, 'El tutor no existe')
  }
  const sesiones = await Sesion.find({
    tutor: perfil._id,
    estado: { $in: ESTADOS_QUE_OCUPAN_FRANJA },
    fecha: { $gte: aFechaGuardada(hoyEnColombia()) },
  }).select('fecha franja').sort({ fecha: 1 })
  return sesiones.map((sesion) => ({ fecha: aTextoDia(sesion.fecha), franja: sesion.franja }))
}
