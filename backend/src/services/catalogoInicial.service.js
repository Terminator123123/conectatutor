import { MATERIAS, PROGRAMAS } from '../datos/catalogoUniguajira.js'
import { Materia, Programa } from '../models/index.js'

/**
 * Crea el documento si todavía no existe. La clave natural (nombre del programa, código de la materia) tiene
 * índice único: si ya está, MongoDB rechaza la inserción y el documento existente queda como estaba.
 * Así una segunda carga, o dos a la vez, no duplican ni cambian nada de lo que Coordinación haya editado.
 * @returns {Promise<boolean>} true si lo creó; false si ya existía.
 */
async function crearSiFalta(Modelo, datos) {
  try {
    await Modelo.create(datos)
    return true
  } catch (error) {
    if (error?.code === 11000) return false
    throw error
  }
}

/**
 * Carga el catálogo académico de Uniguajira (programas y materias) en una base, por ejemplo la de producción.
 * Solo inserta lo que falta: no modifica ni borra nada y no crea cuentas. Necesita los índices creados.
 * @returns {Promise<{programas: {creados: number, existentes: number}, materias: {creadas: number, existentes: number}}>}
 */
export async function cargarCatalogoInicial() {
  const programas = { creados: 0, existentes: 0 }
  for (const datos of PROGRAMAS) {
    if (await crearSiFalta(Programa, datos)) programas.creados += 1
    else programas.existentes += 1
  }

  const materias = { creadas: 0, existentes: 0 }
  const idsDeProgramas = new Map()
  for (const { programa, ...datos } of MATERIAS) {
    if (!idsDeProgramas.has(programa)) {
      const encontrado = await Programa.findOne({ nombre: programa }).select('_id').lean()
      if (!encontrado) throw new Error(`No se encontró el programa «${programa}» para sus materias`)
      idsDeProgramas.set(programa, encontrado._id)
    }
    if (await crearSiFalta(Materia, { ...datos, programa: idsDeProgramas.get(programa), activa: true })) materias.creadas += 1
    else materias.existentes += 1
  }
  return { programas, materias }
}
