import { Notificacion, PerfilTutor, Sesion } from '../models/index.js'
import { EstadoSesion, TipoNotificacion } from '../utils/enums.js'
import { aTextoDia, momentoDeInicio } from '../utils/fechas.js'

// Campana de notificaciones (RQF022). Los avisos de cambios se guardan cuando ocurren;
// los recordatorios se crean al consultar la campana, una sola vez cada uno (campo `clave`).

const MAXIMO_EN_LISTA = 40
const HORA = 60 * 60 * 1000

const primerNombre = (persona) => (persona?.nombre ?? '').split(' ')[0]

/** Texto corto de una sesión: "Cálculo Diferencial, 2026-11-24 a las 08:00". */
function resumen(sesion) {
  return `${sesion.materia?.nombre ?? 'Tutoría'}, ${aTextoDia(sesion.fecha)} a las ${sesion.franja.horaInicio}`
}

/** Crea una notificación. Si ya existe la misma clave (recordatorio repetido), no hace nada. */
async function crear(datos) {
  try {
    await Notificacion.create(datos)
  } catch (error) {
    if (error?.code !== 11000) throw error
  }
}

/**
 * Avisa a la otra parte de un cambio en la sesión. Recibe la sesión ya poblada
 * (solicitante, tutor.estudiante y materia). Nunca hace fallar la acción principal.
 * @param {string} evento Tipo de notificación.
 * @param {import('mongoose').Document} sesion Sesión poblada.
 */
export async function avisarCambio(evento, sesion) {
  const solicitante = sesion.solicitante
  const tutor = sesion.tutor?.estudiante
  if (!solicitante || !tutor) return
  const id = sesion._id
  const detalle = `/sesiones/${id}`
  const textos = {
    [TipoNotificacion.SOLICITUD_NUEVA]: [tutor, `${primerNombre(solicitante)} te pidió una tutoría`, resumen(sesion), '/solicitudes'],
    [TipoNotificacion.SOLICITUD_ACEPTADA]: [solicitante, `${primerNombre(tutor)} aceptó tu solicitud`, resumen(sesion), detalle],
    [TipoNotificacion.SOLICITUD_RECHAZADA]: [solicitante, `${primerNombre(tutor)} no pudo aceptar tu solicitud`, sesion.motivo ?? '', detalle],
    [TipoNotificacion.SESION_FINALIZADA]: [solicitante, `¿Qué tal tu tutoría con ${primerNombre(tutor)}?`, 'La sesión terminó. Califícala y ayuda a otros estudiantes.', `/sesiones/${id}/calificar`],
    [TipoNotificacion.CALIFICACION_RECIBIDA]: [tutor, `${primerNombre(solicitante)} calificó tu tutoría`, `${sesion.calificacion?.puntaje ?? ''} de 5 · ${sesion.materia?.nombre ?? ''}`, '/perfil'],
  }
  if (evento === TipoNotificacion.SESION_CANCELADA || evento === TipoNotificacion.REPROGRAMACION_PROPUESTA
    || evento === TipoNotificacion.REPROGRAMACION_RESPONDIDA) {
    return
  }
  const [destino, titulo, texto, ruta] = textos[evento]
  await crear({ usuario: destino._id, sesion: id, tipo: evento, titulo, texto, ruta })
}

/**
 * Avisos que dependen de quién hizo la acción: cancelación y reprogramación.
 * @param {string} evento Tipo de notificación.
 * @param {import('mongoose').Document} sesion Sesión poblada.
 * @param {import('mongoose').Document} autor Quien actuó; se avisa a la otra parte.
 * @param {boolean} [acepta] En una respuesta a reprogramación, si se aceptó.
 */
export async function avisarAccionDe(evento, sesion, autor, acepta = false) {
  const solicitante = sesion.solicitante
  const tutor = sesion.tutor?.estudiante
  if (!solicitante || !tutor) return
  const autorEsSolicitante = solicitante._id.equals(autor._id)
  const otro = autorEsSolicitante ? tutor : solicitante
  const nombre = primerNombre(autorEsSolicitante ? solicitante : tutor)
  const id = sesion._id
  const titulos = {
    [TipoNotificacion.SESION_CANCELADA]: [`${nombre} canceló la tutoría`, `${resumen(sesion)}. ${sesion.motivo ?? ''}`.trim()],
    [TipoNotificacion.REPROGRAMACION_PROPUESTA]: [`${nombre} propone cambiar la fecha`, `${resumen(sesion)}. Revisa la propuesta y respóndela.`],
    [TipoNotificacion.REPROGRAMACION_RESPONDIDA]: [
      acepta ? `${nombre} aceptó el cambio de fecha` : `${nombre} no aceptó el cambio de fecha`,
      acepta ? `Nueva fecha: ${resumen(sesion)}` : `La tutoría sigue: ${resumen(sesion)}`,
    ],
  }
  const [titulo, texto] = titulos[evento]
  await crear({ usuario: otro._id, sesion: id, tipo: evento, titulo, texto: texto.slice(0, 300), ruta: `/sesiones/${id}` })
}

/**
 * Crea los recordatorios que ya corresponden para las sesiones confirmadas del usuario:
 * un día antes, una hora antes y, al terminar el horario, la invitación a cerrar o calificar.
 */
async function crearRecordatorios(usuario, ahora = new Date()) {
  const perfil = await PerfilTutor.findOne({ estudiante: usuario._id }).select('_id')
  const desde = new Date(ahora.getTime() - 7 * 24 * HORA)
  const sesiones = await Sesion.find({
    estado: EstadoSesion.CONFIRMADA,
    fecha: { $gte: desde },
    $or: [{ solicitante: usuario._id }, ...(perfil ? [{ tutor: perfil._id }] : [])],
  }).populate([
    { path: 'solicitante', select: 'tipo nombre' },
    { path: 'tutor', select: 'estudiante', populate: { path: 'estudiante', select: 'tipo nombre' } },
    { path: 'materia', select: 'nombre' },
  ])

  for (const sesion of sesiones) {
    const dia = aTextoDia(sesion.fecha)
    const inicio = momentoDeInicio(dia, sesion.franja.horaInicio)
    const fin = momentoDeInicio(dia, sesion.franja.horaFin)
    const soyTutor = !sesion.solicitante?._id.equals(usuario._id)
    const otro = soyTutor ? sesion.solicitante : sesion.tutor?.estudiante
    const conQuien = primerNombre(otro)
    const base = { usuario: usuario._id, sesion: sesion._id, ruta: `/sesiones/${sesion._id}` }
    const falta = inicio.getTime() - ahora.getTime()

    if (ahora >= fin) {
      // Terminó el horario: el tutor debe cerrarla para que el estudiante pueda calificar.
      await crear({
        ...base, tipo: TipoNotificacion.SESION_TERMINADA, clave: `fin:${sesion._id}:${dia}:${sesion.franja.horaFin}`,
        titulo: soyTutor ? `¿Terminaste la tutoría con ${conQuien}?` : `¿Terminó tu tutoría con ${conQuien}?`,
        texto: soyTutor ? 'Márcala como finalizada para que pueda calificarte.' : 'Cuando el tutor la marque como finalizada podrás calificarla.',
      })
    } else if (falta > 0 && falta <= HORA) {
      await crear({
        ...base, tipo: TipoNotificacion.RECORDATORIO, clave: `1h:${sesion._id}:${dia}:${sesion.franja.horaInicio}`,
        titulo: `Tu tutoría con ${conQuien} empieza pronto`, texto: `Hoy a las ${sesion.franja.horaInicio} · ${sesion.materia?.nombre ?? ''}`,
      })
    } else if (falta > HORA && falta <= 24 * HORA) {
      await crear({
        ...base, tipo: TipoNotificacion.RECORDATORIO, clave: `24h:${sesion._id}:${dia}:${sesion.franja.horaInicio}`,
        titulo: `Mañana tienes tutoría con ${conQuien}`, texto: resumen(sesion),
      })
    }
  }
}

/** Lista las notificaciones del usuario, las más nuevas primero, y cuántas no ha leído. */
export async function listar(usuario, ahora = new Date()) {
  await crearRecordatorios(usuario, ahora)
  const [notificaciones, sinLeer] = await Promise.all([
    Notificacion.find({ usuario: usuario._id }).sort({ createdAt: -1 }).limit(MAXIMO_EN_LISTA),
    Notificacion.countDocuments({ usuario: usuario._id, leida: false }),
  ])
  return { sinLeer, notificaciones: notificaciones.map((notificacion) => notificacion.toJSON()) }
}

/** Marca como leídas todas las notificaciones del usuario. */
export async function marcarLeidas(usuario) {
  await Notificacion.updateMany({ usuario: usuario._id, leida: false }, { $set: { leida: true } })
}
