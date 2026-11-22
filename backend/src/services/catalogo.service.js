import { Estudiante, Facultad, Materia, PerfilTutor, Programa } from '../models/index.js'
import { HttpError } from '../utils/HttpError.js'

// Catálogo académico: facultades, programas y materias (RQF008, RQF027).

/** Lista las facultades en orden alfabético. */
export function listarFacultades() {
  return Facultad.find().sort({ nombre: 1 })
}

/** Busca una facultad o responde 404. */
export async function obtenerFacultad(id) {
  const facultad = await Facultad.findById(id)
  if (!facultad) throw new HttpError(404, 'La facultad no existe')
  return facultad
}

function traducirFacultadRepetida(error, nombre) {
  if (error?.code === 11000) return new HttpError(409, `Ya existe una facultad llamada ${nombre}`)
  return error
}

/** Crea una facultad. */
export async function crearFacultad({ nombre }) {
  try {
    return await Facultad.create({ nombre })
  } catch (error) {
    throw traducirFacultadRepetida(error, nombre)
  }
}

/** Cambia el nombre de una facultad y lo actualiza en sus programas. */
export async function editarFacultad(id, { nombre }) {
  const facultad = await obtenerFacultad(id)
  const anterior = facultad.nombre
  facultad.nombre = nombre
  try {
    await facultad.save()
  } catch (error) {
    throw traducirFacultadRepetida(error, nombre)
  }
  if (anterior !== nombre) await Programa.updateMany({ facultad: anterior }, { $set: { facultad: nombre } })
  return facultad
}

/** Borra una facultad que no tiene programas. */
export async function eliminarFacultad(id) {
  const facultad = await obtenerFacultad(id)
  const programas = await Programa.countDocuments({ facultad: facultad.nombre })
  if (programas > 0) {
    throw new HttpError(409, 'No se puede borrar una facultad con programas', [`Tiene ${programas} programa(s)`])
  }
  await facultad.deleteOne()
  return facultad
}

async function exigirFacultad(nombre) {
  if (nombre !== undefined && !(await Facultad.exists({ nombre }))) {
    throw new HttpError(400, 'Los datos del programa no son válidos', ['La facultad no existe'])
  }
}

/** Lista los programas académicos en orden alfabético. */
export function listarProgramas() {
  return Programa.find().sort({ nombre: 1 })
}

/** Busca un programa o responde 404. */
export async function obtenerPrograma(id) {
  const programa = await Programa.findById(id)
  if (!programa) throw new HttpError(404, 'El programa no existe')
  return programa
}

/** Convierte el error de índice único del nombre en un 409 con mensaje claro. */
function traducirNombreRepetido(error, nombre) {
  if (error?.code === 11000) return new HttpError(409, `Ya existe un programa llamado ${nombre}`)
  return error
}

/** Agrega un programa académico. */
export async function crearPrograma({ nombre, facultad }) {
  await exigirFacultad(facultad)
  try {
    return await Programa.create({ nombre, facultad })
  } catch (error) {
    throw traducirNombreRepetido(error, nombre)
  }
}

/** Cambia el nombre o la facultad de un programa. Solo se tocan los campos enviados. */
export async function editarPrograma(id, cambios) {
  const programa = await obtenerPrograma(id)
  await exigirFacultad(cambios.facultad)
  programa.set(cambios)
  try {
    await programa.save()
  } catch (error) {
    throw traducirNombreRepetido(error, cambios.nombre)
  }
  return programa
}

/**
 * Borra un programa que nadie usa. Si tiene materias o estudiantes responde 409:
 * borrarlo dejaría esas materias y cuentas apuntando a un programa que no existe.
 */
export async function eliminarPrograma(id) {
  const programa = await obtenerPrograma(id)
  const [materias, estudiantes] = await Promise.all([
    Materia.countDocuments({ programa: programa._id }),
    Estudiante.countDocuments({ programa: programa._id }),
  ])
  if (materias > 0 || estudiantes > 0) {
    throw new HttpError(409, 'No se puede borrar un programa en uso', [
      `Tiene ${materias} materia(s) y ${estudiantes} estudiante(s). Muévelos a otro programa antes de borrarlo`,
    ])
  }
  await programa.deleteOne()
  return programa
}

/**
 * Lista las materias del catálogo.
 * @param {object} filtros
 * @param {string} [filtros.programa] Id del programa.
 * @param {boolean} [filtros.incluirInactivas] Solo lo puede pedir el administrador.
 */
export function listarMaterias({ programa, incluirInactivas = false } = {}) {
  const filtro = {}
  if (programa) filtro.programa = programa
  if (!incluirInactivas) filtro.activa = true
  return Materia.find(filtro).populate('programa').sort({ codigo: 1 })
}

/** Busca una materia o responde 404. */
export async function obtenerMateria(id) {
  const materia = await Materia.findById(id).populate('programa')
  if (!materia) throw new HttpError(404, 'La materia no existe')
  return materia
}

async function exigirPrograma(id) {
  if (!(await Programa.exists({ _id: id }))) {
    throw new HttpError(400, 'Los datos de la materia no son válidos', ['El programa seleccionado no existe'])
  }
}

/** Convierte el error de índice único en un 409 con mensaje claro. */
function traducirCodigoRepetido(error, codigo) {
  if (error?.code === 11000) {
    return new HttpError(409, `Ya existe una materia con el código ${codigo}`)
  }
  return error
}

/** Agrega una materia al catálogo. */
export async function crearMateria({ codigo, nombre, programa }) {
  await exigirPrograma(programa)
  try {
    const materia = await Materia.create({ codigo, nombre, programa })
    return materia.populate('programa')
  } catch (error) {
    throw traducirCodigoRepetido(error, codigo)
  }
}

/** Cambia los datos de una materia. Solo se tocan los campos enviados. */
export async function editarMateria(id, cambios) {
  const materia = await obtenerMateria(id)
  if (cambios.programa !== undefined) await exigirPrograma(cambios.programa)
  materia.set(cambios)
  try {
    await materia.save()
  } catch (error) {
    throw traducirCodigoRepetido(error, cambios.codigo)
  }
  return materia.populate('programa')
}

/**
 * Retira una materia del catálogo sin borrarla (borrado lógico).
 * Las sesiones ya registradas la conservan; deja de ofrecerse y de aparecer en búsquedas.
 */
export async function desactivarMateria(id) {
  const materia = await obtenerMateria(id)
  materia.activa = false
  await materia.save()
  // Se quita de los perfiles que la ofrecían para que nadie la pueda solicitar.
  await PerfilTutor.updateMany({ materias: materia._id }, { $pull: { materias: materia._id } })
  return materia
}
