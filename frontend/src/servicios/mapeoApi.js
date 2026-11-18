import Administrador from '../modelo/Administrador.js'
import Estudiante from '../modelo/Estudiante.js'
import Materia from '../modelo/Materia.js'
import PerfilTutor from '../modelo/PerfilTutor.js'
import Programa from '../modelo/Programa.js'
import Sesion from '../modelo/Sesion.js'
import FranjaHoraria from '../modelo/FranjaHoraria.js'
import { EstadoVerificacion, RolUsuario } from '../modelo/enums.js'

function objeto(datos, etiqueta) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new TypeError(`Faltan los datos de ${etiqueta} en la respuesta de la API`)
  }
  return datos
}

function texto(valor, etiqueta, { vacio = false } = {}) {
  if (typeof valor !== 'string' || (!vacio && !valor.trim())) {
    throw new TypeError(`Falta ${etiqueta} en la respuesta de la API`)
  }
  return valor
}

function idDe(datos, etiqueta) {
  const valor = typeof datos === 'string' ? datos : datos?.getId?.() ?? datos?.id
  return texto(valor, `el identificador de ${etiqueta}`)
}

function contextoDe({ programas = [], materias = [], perfiles = [] } = {}) {
  return {
    programas: new Map(programas.map((programa) => [programa.getId(), programa])),
    materias: new Map(materias.map((materia) => [materia.getId(), materia])),
    perfiles: new Map(perfiles.map((perfil) => [perfil.getId(), perfil])),
  }
}

function programaDe(datos, contexto) {
  const id = idDe(datos, 'programa')
  const existente = contexto.programas.get(id)
  if (existente) return existente
  if (!(datos instanceof Programa) && typeof datos !== 'object') {
    throw new TypeError(`Faltan los datos del programa ${id}; carga el catálogo de programas`)
  }
  const programa = datos instanceof Programa ? datos : programaDesdeApi(datos)
  contexto.programas.set(id, programa)
  return programa
}

function materiaDe(datos, contexto) {
  const id = idDe(datos, 'materia')
  const existente = contexto.materias.get(id)
  if (existente) return existente
  if (!(datos instanceof Materia) && typeof datos !== 'object') {
    throw new TypeError(`Faltan los datos de la materia ${id}; carga el catálogo de materias`)
  }
  const materia = datos instanceof Materia ? datos : reconstruirMateria(datos, contexto)
  contexto.materias.set(id, materia)
  return materia
}

function lista(valor, etiqueta) {
  if (!Array.isArray(valor)) throw new TypeError(`Falta ${etiqueta} en la respuesta de la API`)
  return valor
}

function fechaConFranja(fecha, franja) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new TypeError('La fecha de la API debe tener el formato AAAA-MM-DD')
  }
  const dia = new Date(`${fecha}T00:00:00.000Z`)
  if (Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== fecha) {
    throw new TypeError('La fecha de la API no es un día válido')
  }
  return new Date(`${fecha}T${franja.getHoraInicio()}:00-05:00`)
}

function fechaValida(valor, etiqueta) {
  if (typeof valor !== 'string') throw new TypeError(`Falta ${etiqueta} en la respuesta de la API`)
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) throw new TypeError(`${etiqueta} no es una fecha válida`)
  return fecha
}

export function programaDesdeApi(datos) {
  objeto(datos, 'programa')
  return Programa.desdeJSON({
    id: idDe(datos, 'programa'),
    nombre: texto(datos.nombre, 'el nombre del programa'),
    facultad: texto(datos.facultad, 'la facultad del programa'),
  })
}

function reconstruirMateria(datos, contexto) {
  objeto(datos, 'materia')
  const programa = programaDe(datos.programa, contexto)
  return Materia.desdeJSON({
    id: idDe(datos, 'materia'),
    codigo: texto(datos.codigo, 'el código de la materia'),
    nombre: texto(datos.nombre, 'el nombre de la materia'),
    programaId: programa.getId(),
  }, { buscarPrograma: () => programa })
}

export function materiaDesdeApi(datos, { programas = [] } = {}) {
  return reconstruirMateria(datos, contextoDe({ programas }))
}

// Cuentas creadas por Coordinación que aún no completan el primer acceso. Se marca aparte
// para no cambiar las clases del dominio por un dato que solo importa a la navegación.
const sinActivar = new WeakSet()

/** Indica si la cuenta debe crear su contraseña y aceptar el tratamiento de datos antes de seguir. */
export function cuentaSinActivar(usuario) {
  return Boolean(usuario) && sinActivar.has(usuario)
}

function reconstruirUsuario(datos, contexto) {
  const usuario = reconstruirUsuarioBase(datos, contexto)
  if (datos.primerAccesoPendiente === true) sinActivar.add(usuario)
  return usuario
}

function reconstruirUsuarioBase(datos, contexto) {
  objeto(datos, 'usuario')
  const comunes = {
    id: idDe(datos, 'usuario'),
    nombre: texto(datos.nombre, 'el nombre del usuario'),
    correoInstitucional: datos.correoInstitucional == null ? '' : texto(datos.correoInstitucional, 'el correo institucional', { vacio: true }),
  }
  const esEstudiantePublico = datos.programa !== undefined || datos.semestre !== undefined || datos.sede !== undefined
  const tipo = datos.tipo ?? (esEstudiantePublico ? RolUsuario.ESTUDIANTE : undefined)
  if (tipo === RolUsuario.ADMINISTRADOR) {
    return Administrador.desdeJSON({ ...comunes, dependencia: texto(datos.dependencia, 'la dependencia del administrador') })
  }
  if (tipo !== RolUsuario.ESTUDIANTE) throw new TypeError('El tipo de usuario de la API no es válido')
  if (!Number.isInteger(datos.semestre) || datos.semestre < 1) throw new TypeError('Falta un semestre válido en la respuesta de la API')
  const programa = programaDe(datos.programa, contexto)
  return Estudiante.desdeJSON({
    ...comunes, semestre: datos.semestre, sede: texto(datos.sede, 'la sede del estudiante'), programaId: programa.getId(),
  }, { buscarPrograma: () => programa })
}

export function usuarioDesdeApi(datos, { programas = [] } = {}) {
  return reconstruirUsuario(datos, contextoDe({ programas }))
}

function reconstruirPerfil(datos, contexto) {
  objeto(datos, 'perfil de tutor')
  const estudiante = reconstruirUsuario(datos.estudiante, contexto)
  if (!(estudiante instanceof Estudiante)) throw new TypeError('El dueño del perfil debe ser un estudiante')
  const oferta = lista(datos.materias, 'la lista de materias del tutor').map((materia) => materiaDe(materia, contexto))
  const disponibilidad = lista(datos.disponibilidad, 'la disponibilidad del tutor')
  if (datos.tarifaHora === undefined) throw new TypeError('Falta la tarifa del tutor en la respuesta de la API')
  return PerfilTutor.desdeJSON({
    id: idDe(datos, 'perfil de tutor'), estudianteId: estudiante.getId(),
    biografia: texto(datos.biografia, 'la biografía del tutor', { vacio: true }),
    estadoVerificacion: datos.estadoVerificacion, motivoRechazo: datos.motivoRechazo ?? null,
    tarifaHora: datos.tarifaHora, materiaIds: oferta.map((materia) => materia.getId()), disponibilidad,
  }, {
    buscarEstudiante: () => estudiante,
    buscarMateria: (id) => oferta.find((materia) => materia.getId() === id),
  })
}

export function perfilDesdeApi(datos, { programas = [], materias = [] } = {}) {
  return reconstruirPerfil(datos, contextoDe({ programas, materias }))
}

export function sesionDesdeApi(datos, { programas = [], materias = [], perfiles = [] } = {}) {
  const contexto = contextoDe({ programas, materias, perfiles })
  objeto(datos, 'sesión')
  const id = idDe(datos, 'sesión')
  const solicitante = reconstruirUsuario(datos.solicitante, contexto)
  if (!(solicitante instanceof Estudiante)) throw new TypeError('El solicitante debe ser un estudiante')
  const tutor = objeto(datos.tutor, 'tutor de la sesión')
  const idTutor = idDe(tutor, 'perfil de tutor')
  const completo = contexto.perfiles.get(idTutor)
  if (completo && completo.getEstudiante().getId() !== idDe(tutor.estudiante, 'estudiante tutor')) {
    throw new TypeError('El dueño del perfil no coincide con el tutor de la sesión')
  }
  // El contacto pertenece a esta respuesta; no se hereda de perfiles de otras vistas
  const perfil = reconstruirPerfil({
    id: idTutor, estudiante: tutor.estudiante, tarifaHora: tutor.tarifaHora,
    biografia: completo?.getBiografia() ?? '',
    estadoVerificacion: completo?.getEstadoVerificacion() ?? EstadoVerificacion.PENDIENTE,
    motivoRechazo: completo?.getMotivoRechazo() ?? null,
    materias: completo?.getMaterias() ?? [],
    disponibilidad: completo?.getDisponibilidad().map((franja) => franja.toJSON()) ?? [],
  }, contexto)
  const materia = materiaDe(datos.materia, contexto)
  const franja = FranjaHoraria.desdeJSON(objeto(datos.franja, 'franja de la sesión'))
  const fecha = fechaConFranja(datos.fecha, franja)
  let calificacion = null
  if (datos.calificacion != null) {
    objeto(datos.calificacion, 'calificación')
    calificacion = {
      // La nota embebida no tiene id propio en la API; este id solo existe en el modelo local
      id: datos.calificacion.id ?? `${id}:calificacion`,
      puntaje: datos.calificacion.puntaje,
      resena: datos.calificacion.resena ?? '',
      fecha: fechaValida(datos.calificacion.fecha, 'La fecha de calificación').toISOString(),
    }
  }
  return Sesion.desdeJSON({
    id, solicitanteId: solicitante.getId(), perfilTutorId: perfil.getId(), materiaId: materia.getId(),
    franja: franja.toJSON(), fecha: fecha.toISOString(), tema: texto(datos.tema, 'el tema de la sesión'),
    estado: datos.estado, motivo: datos.motivo ?? null, calificacion,
  }, {
    buscarEstudiante: () => solicitante,
    buscarPerfilTutor: () => perfil,
    buscarMateria: () => materia,
  })
}

export function reprogramacionDesdeApi(datos) {
  if (datos == null) return null
  objeto(datos, 'propuesta de reprogramación')
  const franja = FranjaHoraria.desdeJSON(objeto(datos.franja, 'franja propuesta'))
  if (typeof datos.esMia !== 'boolean') throw new TypeError('Falta la pertenencia de la propuesta de reprogramación')
  return {
    propuestaPor: idDe(datos.propuestaPor, 'autor de la propuesta'), esMia: datos.esMia,
    fecha: fechaConFranja(datos.fecha, franja), franja,
    motivo: datos.motivo ?? '', propuestaEl: fechaValida(datos.propuestaEl, 'La fecha de propuesta'),
  }
}
