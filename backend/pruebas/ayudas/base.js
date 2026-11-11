// Debe importarse ANTES que cualquier archivo de src/: fija el entorno de prueba.
process.env.NODE_ENV = 'test'

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let servidor = null

/**
 * Arranca una base de MongoDB en memoria solo para las pruebas.
 * Las pruebas nunca usan MONGODB_URI: no tocan la base real.
 */
export async function iniciarBaseDePrueba() {
  servidor = await MongoMemoryServer.create()
  await mongoose.connect(servidor.getUri('conectatutor_pruebas'))
  const { asegurarIndices } = await import('../../src/models/index.js')
  await asegurarIndices()
}

/** Borra todos los documentos y conserva los índices. */
export async function vaciarBaseDePrueba() {
  const colecciones = await mongoose.connection.db.collections()
  await Promise.all(colecciones.map((coleccion) => coleccion.deleteMany({})))
}

/** Cierra la conexión y apaga la base en memoria. */
export async function detenerBaseDePrueba() {
  await mongoose.disconnect()
  if (servidor) await servidor.stop()
  servidor = null
}

/** Contraseña que usan las pruebas para las cuentas de demostración. */
export const CLAVE_DE_PRUEBA = 'ClaveDePrueba1'
