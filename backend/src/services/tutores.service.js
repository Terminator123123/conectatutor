import { Estudiante, Materia, PerfilTutor, Sesion } from '../models/index.js'
import { EstadoSesion, EstadoVerificacion, RolUsuario } from '../utils/enums.js'
import { HttpError } from '../utils/HttpError.js'

// Perfiles de tutor: el propio (RQF006, RQF007, RQF026) y la búsqueda pública
// (RQF009, RQF010, RQF011, RQF018, RQF019, RQF020).

/** Lo que se carga de cada perfil para mostrarlo: su dueño con el programa, y las materias. */
const DATOS_DEL_PERFIL = [
  { path: 'estudiante', populate: { path: 'programa' } },
  { path: 'materias', populate: { path: 'programa' } },
]

const SIN_ESTADISTICAS = Object.freeze({ promedio: 0, totalCalificaciones: 0, tutoriasCompletadas: 0 })

/**
 * Calcula, a partir de las sesiones finalizadas, el promedio de calificaciones
 * (RQF018) y el número de tutorías completadas (RQF019) de cada perfil.
 * No se guarda en ningún lado: siempre sale de las sesiones.
 * @param {import('mongoose').Types.ObjectId[]} perfilIds
 * @returns {Promise<Map<string, {promedio: number, totalCalificaciones: number, tutoriasCompletadas: number}>>}
 */
export async function calcularEstadisticas(perfilIds) {
  const filas = await Sesion.aggregate([
    { $match: { tutor: { $in: perfilIds }, estado: EstadoSesion.FINALIZADA } },
    {
      $group: {
        _id: '$tutor',
        tutoriasCompletadas: { $sum: 1 },
        totalCalificaciones: { $sum: { $cond: [{ $gt: ['$calificacion.puntaje', null] }, 1, 0] } },
        sumaPuntajes: { $sum: { $ifNull: ['$calificacion.puntaje', 0] } },
      },
    },
  ])
  const estadisticas = new Map()
  for (const fila of filas) {
    estadisticas.set(String(fila._id), {
      // Un decimal, igual que lo muestra la aplicación: 4.666 -> 4.7
      promedio: fila.totalCalificaciones > 0 ? Math.round((fila.sumaPuntajes / fila.totalCalificaciones) * 10) / 10 : 0,
      totalCalificaciones: fila.totalCalificaciones,
      tutoriasCompletadas: fila.tutoriasCompletadas,
    })
  }
  return estadisticas
}

/**
 * Arma lo que la API muestra de un perfil de tutor.
 * RQF020: del dueño solo salen nombre, semestre, sede y programa; nunca el correo
 * ni ningún otro dato de contacto.
 * @param {import('mongoose').Document} perfil Perfil con estudiante y materias cargados.
 * @param {object} estadisticas Resultado de calcularEstadisticas para ese perfil.
 * @param {{propio?: boolean}} [opciones] `propio`: incluye lo que solo ve el dueño o el administrador.
 */
export function presentarPerfil(perfil, estadisticas = SIN_ESTADISTICAS, { propio = false } = {}) {
  const { estudiante } = perfil
  const salida = {
    id: perfil.id,
    estudiante: {
      id: estudiante.id,
      nombre: estudiante.nombre,
      semestre: estudiante.semestre,
      sede: estudiante.sede,
      programa: estudiante.programa,
    },
    biografia: perfil.biografia,
    tarifaHora: perfil.tarifaHora,
    estadoVerificacion: perfil.estadoVerificacion,
    // Las materias retiradas del catálogo no se muestran.
    materias: perfil.materias.filter((materia) => materia.activa),
    disponibilidad: perfil.disponibilidad,
    ...estadisticas,
  }
  if (propio) salida.motivoRechazo = perfil.motivoRechazo
  return salida
}

/** Devuelve el perfil de tutor del estudiante, o null si no lo ha activado. */
export async function obtenerMiPerfil(estudianteId) {
  const perfil = await PerfilTutor.findOne({ estudiante: estudianteId }).populate(DATOS_DEL_PERFIL)
  if (!perfil) return null
  const estadisticas = await calcularEstadisticas([perfil._id])
  return presentarPerfil(perfil, estadisticas.get(perfil.id), { propio: true })
}

/**
 * Activa el perfil de tutor del estudiante o guarda sus cambios (RQF006, RQF007, RQF026).
 * El perfil siempre se busca por el dueño de la sesión: nadie puede tocar el de otro.
 * @param {string} estudianteId Id del usuario con la sesión iniciada.
 * @param {{biografia: string, tarifaHora: number|null, materias: string[], disponibilidad: object[]}} datos
 * @returns {Promise<{perfil: object, creado: boolean}>}
 */
export async function guardarMiPerfil(estudianteId, { biografia, tarifaHora, materias, disponibilidad }) {
  // Solo se pueden ofrecer materias que existan y estén activas en el catálogo.
  const existentes = await Materia.countDocuments({ _id: { $in: materias }, activa: true })
  if (existentes !== materias.length) {
    throw new HttpError(400, 'Los datos del perfil no son válidos', ['Alguna de las materias no existe o fue retirada del catálogo'])
  }

  let perfil = await PerfilTutor.findOne({ estudiante: estudianteId })
  const creado = !perfil
  if (creado) perfil = new PerfilTutor({ estudiante: estudianteId })

  perfil.set({ biografia, tarifaHora, materias, disponibilidad })

  // Un perfil rechazado que se corrige vuelve a la cola de revisión.
  if (perfil.estadoVerificacion === EstadoVerificacion.RECHAZADO) {
    perfil.estadoVerificacion = EstadoVerificacion.PENDIENTE
    perfil.motivoRechazo = null
  }

  try {
    await perfil.save() // aquí el esquema valida R9 (franjas sin solaparse) y R10 (tarifa)
  } catch (error) {
    // Dos activaciones a la vez: el índice único deja un solo perfil por estudiante.
    if (error?.code === 11000) throw new HttpError(409, 'Ya tienes un perfil de tutor')
    throw error
  }

  return { perfil: await obtenerMiPerfil(estudianteId), creado }
}

/**
 * Busca tutores verificados (RQF009, RQF010).
 * @param {object} filtros Ya validados por validarBusquedaTutores.
 * @param {string} [filtros.materia] Id de la materia que debe ofrecer.
 * @param {string} [filtros.programa] Id del programa del tutor.
 * @param {string} [filtros.sede] Sede del tutor.
 * @param {string} [filtros.dia] Día con al menos una franja disponible.
 * @param {number} [filtros.precioMaximo] Tarifa máxima por hora; las gratuitas siempre entran.
 * @param {boolean} [filtros.soloGratuitas] Solo tutorías sin tarifa.
 * @param {number} [filtros.calificacionMinima] Promedio mínimo de 1 a 5.
 */
/**
 * Perfiles publicados: verificados y con algo que ofrecer (al menos una materia y una franja).
 * Coordinación no verifica un perfil vacío; si uno ya verificado se vacía al editarlo, sale
 * de la búsqueda, del detalle público y de favoritos hasta que vuelva a tener oferta.
 */
export const FILTRO_PUBLICADO = Object.freeze({
  estadoVerificacion: EstadoVerificacion.VERIFICADO,
  'materias.0': { $exists: true },
  'disponibilidad.0': { $exists: true },
})

/** Lo mismo que FILTRO_PUBLICADO para un perfil ya cargado. */
export function estaPublicado(perfil) {
  return perfil.estadoVerificacion === EstadoVerificacion.VERIFICADO && perfil.materias.length > 0 && perfil.disponibilidad.length > 0
}

export async function buscarTutores({ materia, programa, sede, dia, precioMaximo, soloGratuitas, calificacionMinima } = {}) {
  // Regla fija: en la búsqueda solo aparecen perfiles VERIFICADOS que ofrecen algo.
  const filtro = { ...FILTRO_PUBLICADO }

  if (materia) {
    // Una materia retirada del catálogo no produce resultados.
    if (!(await Materia.exists({ _id: materia, activa: true }))) return []
    filtro.materias = materia
  }
  if (dia) filtro['disponibilidad.dia'] = dia
  if (soloGratuitas) {
    filtro.tarifaHora = null
  } else if (precioMaximo !== undefined) {
    filtro.$or = [{ tarifaHora: null }, { tarifaHora: { $lte: precioMaximo } }]
  }
  if (programa || sede) {
    const filtroEstudiante = {}
    if (programa) filtroEstudiante.programa = programa
    if (sede) filtroEstudiante.sede = sede
    filtro.estudiante = { $in: await Estudiante.find(filtroEstudiante).distinct('_id') }
  }

  const perfiles = await PerfilTutor.find(filtro).populate(DATOS_DEL_PERFIL)
  const estadisticas = await calcularEstadisticas(perfiles.map((perfil) => perfil._id))

  return perfiles
    .map((perfil) => presentarPerfil(perfil, estadisticas.get(perfil.id)))
    .filter((perfil) => calificacionMinima === undefined || perfil.promedio >= calificacionMinima)
    // Mejor calificados primero; a igual promedio, por nombre.
    .sort((a, b) => b.promedio - a.promedio || a.estudiante.nombre.localeCompare(b.estudiante.nombre, 'es'))
}

/** "Elena Lozano" -> "Elena L.": las reseñas muestran quién opinó sin exponer el nombre completo. */
function abreviarNombre(nombre) {
  const [primero, ...resto] = nombre.trim().split(/\s+/)
  return resto.length > 0 ? `${primero} ${resto[0][0]}.` : primero
}

/**
 * Devuelve el perfil público de un tutor con sus reseñas (RQF011).
 * Un perfil que no está publicado (sin verificar, o sin materias o franjas) solo lo
 * ven su dueño y el administrador; para los demás no existe.
 * @param {string} perfilId
 * @param {import('mongoose').Document} usuario Quien consulta.
 */
export async function obtenerDetalle(perfilId, usuario) {
  const perfil = await PerfilTutor.findById(perfilId).populate(DATOS_DEL_PERFIL)
  if (!perfil) throw new HttpError(404, 'El tutor no existe')

  // Sin sesión (visitante) solo se ven perfiles verificados.
  const esDueno = Boolean(usuario) && perfil.estudiante._id.equals(usuario._id)
  const esAdministrador = usuario?.tipo === RolUsuario.ADMINISTRADOR
  if (!estaPublicado(perfil) && !esDueno && !esAdministrador) {
    throw new HttpError(404, 'El tutor no existe')
  }

  const [estadisticas, calificadas] = await Promise.all([
    calcularEstadisticas([perfil._id]),
    Sesion.find({ tutor: perfil._id, estado: EstadoSesion.FINALIZADA, calificacion: { $ne: null } })
      .populate('solicitante', 'tipo nombre')
      .populate('materia', 'nombre')
      .sort({ 'calificacion.fecha': -1 }),
  ])

  return {
    ...presentarPerfil(perfil, estadisticas.get(perfil.id), { propio: esDueno || esAdministrador }),
    resenas: calificadas.map((sesion) => ({
      puntaje: sesion.calificacion.puntaje,
      resena: sesion.calificacion.resena,
      fecha: sesion.calificacion.fecha,
      autor: sesion.solicitante ? abreviarNombre(sesion.solicitante.nombre) : 'Estudiante',
      materia: sesion.materia?.nombre ?? null,
    })),
  }
}
