import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { once } from 'node:events'
import { finished } from 'node:stream/promises'
import mongoose from 'mongoose'
import { Materia, Notificacion, PerfilTutor, Programa, Sesion, Usuario } from '../models/index.js'

const { EJSON } = mongoose.mongo.BSON

/** Colecciones de la aplicación que entran en el respaldo (RQNF010). */
export const COLECCIONES_RESPALDADAS = Object.freeze(
  [Programa, Materia, Usuario, PerfilTutor, Sesion, Notificacion].map((modelo) => modelo.collection.collectionName),
)

/** Nombre del manifiesto que describe cada respaldo. */
export const MANIFIESTO = 'manifiesto.json'

/** Formato de los archivos: un arreglo por colección en EJSON canónico, que conserva ObjectId, fechas, enteros e imágenes. */
export const FORMATO = 'EJSON canónico v2, un arreglo de documentos por colección'

/** Carpeta de un respaldo: fecha y hora UTC, ordenable y válida en Windows. */
export function nombreDeRespaldo(fecha) {
  return `respaldo-${fecha.toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-')}`
}

/**
 * Escribe en un archivo nuevo, parte por parte y respetando la contrapresión, para no cargar toda una
 * colección en memoria. Si algo falla, cierra el archivo antes de propagar el error.
 * @param {string} ruta
 * @param {Iterable<string>|AsyncIterable<string>} partes
 */
async function volcar(ruta, partes) {
  // `wx`: nunca reemplaza un archivo que ya exista
  const flujo = createWriteStream(ruta, { encoding: 'utf8', flags: 'wx' })
  const terminado = finished(flujo)
  terminado.catch(() => {}) // se espera más abajo; así un error temprano no queda sin atender
  try {
    for await (const parte of partes) {
      if (flujo.errored) throw flujo.errored
      if (!flujo.write(parte)) await once(flujo, 'drain')
    }
    flujo.end()
    await terminado
  } catch (error) {
    flujo.destroy()
    await terminado.catch(() => {})
    throw error
  }
}

/** Partes del archivo de una colección: un arreglo JSON con un documento por línea. Anota el total en `cuenta`. */
async function* documentosDe(coleccion, cuenta) {
  yield '['
  for await (const documento of coleccion.find({}, { sort: { _id: 1 } })) {
    yield `${cuenta.total === 0 ? '\n' : ',\n'}${EJSON.stringify(documento, { relaxed: false })}`
    cuenta.total += 1
  }
  yield cuenta.total === 0 ? ']\n' : '\n]\n'
}

/**
 * Exporta cada colección de la aplicación a `<colección>.json` dentro de una carpeta nueva y deja un manifiesto
 * con la fecha, la base y el número de documentos de cada una. El respaldo es completo para poder restaurarlo:
 * incluye las contraseñas cifradas y las fotos, así que contiene datos personales y debe guardarse en privado.
 * Nunca sobrescribe un respaldo anterior; si algo falla, borra la carpeta a medias.
 * @param {object} opciones
 * @param {string} opciones.carpetaBase Carpeta donde se crea el respaldo.
 * @param {Date} [opciones.fecha] Momento del respaldo (da el nombre de la carpeta).
 * @param {mongoose.Connection} [opciones.conexion] Conexión abierta con la base que se respalda.
 * @returns {Promise<{carpeta: string, colecciones: Record<string, number>}>}
 */
export async function exportarRespaldo({ carpetaBase, fecha = new Date(), conexion = mongoose.connection }) {
  if (!conexion.db) throw new Error('No hay conexión con la base de datos')
  await mkdir(carpetaBase, { recursive: true })
  const carpeta = path.join(carpetaBase, nombreDeRespaldo(fecha))
  // Sin recursive: si la carpeta ya existe, falla en lugar de mezclar dos respaldos
  await mkdir(carpeta)
  const colecciones = {}
  try {
    for (const nombre of COLECCIONES_RESPALDADAS) {
      const cuenta = { total: 0 }
      await volcar(path.join(carpeta, `${nombre}.json`), documentosDe(conexion.db.collection(nombre), cuenta))
      colecciones[nombre] = cuenta.total
    }
    const manifiesto = { formato: FORMATO, fecha: fecha.toISOString(), baseDeDatos: conexion.name, colecciones }
    await volcar(path.join(carpeta, MANIFIESTO), [`${JSON.stringify(manifiesto, null, 2)}\n`])
  } catch (error) {
    await rm(carpeta, { recursive: true, force: true })
    throw error
  }
  return { carpeta, colecciones }
}

/**
 * Lee un respaldo y comprueba que esté completo: manifiesto válido, un archivo por colección, EJSON legible
 * y el mismo número de documentos que anota el manifiesto. No toca ninguna base.
 * @param {string} carpeta Carpeta del respaldo.
 * @returns {Promise<{manifiesto: object, documentos: Record<string, object[]>}>} Los documentos ya convertidos.
 */
export async function leerRespaldo(carpeta) {
  let manifiesto
  try {
    manifiesto = JSON.parse(await readFile(path.join(carpeta, MANIFIESTO), 'utf8'))
  } catch (error) {
    throw new Error(`No se pudo leer ${MANIFIESTO}: ${error.message}`)
  }
  if (manifiesto?.formato !== FORMATO || typeof manifiesto.colecciones !== 'object' || manifiesto.colecciones === null) {
    throw new Error(`${MANIFIESTO} no describe un respaldo de ConectaTutor`)
  }
  const documentos = {}
  for (const nombre of COLECCIONES_RESPALDADAS) {
    const esperado = manifiesto.colecciones[nombre]
    if (!Number.isInteger(esperado) || esperado < 0) throw new Error(`El manifiesto no indica cuántos documentos tiene ${nombre}`)
    let lista
    try {
      lista = EJSON.parse(await readFile(path.join(carpeta, `${nombre}.json`), 'utf8'), { relaxed: false })
    } catch (error) {
      throw new Error(`No se pudo leer ${nombre}.json: ${error.message}`)
    }
    if (!Array.isArray(lista)) throw new Error(`${nombre}.json no contiene una lista de documentos`)
    if (lista.length !== esperado) throw new Error(`${nombre}.json tiene ${lista.length} documentos y el manifiesto dice ${esperado}`)
    documentos[nombre] = lista
  }
  return { manifiesto, documentos }
}
