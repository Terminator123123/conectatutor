import { Materia, PerfilTutor, Programa } from '../models/index.js'
import { HttpError } from '../utils/HttpError.js'

// Catálogo académico: programas (solo lectura) y materias (RQF008, RQF027).

/** Lista los programas académicos en orden alfabético. */
export function listarProgramas() {
  return Programa.find().sort({ nombre: 1 })
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
