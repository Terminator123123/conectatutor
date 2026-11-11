import mongoose from 'mongoose'

/** Servidor temporal de MongoDB, solo cuando no hay MONGODB_URI en desarrollo. */
let servidorEnMemoria = null

/**
 * Abre la conexión con MongoDB usando Mongoose.
 * Se llama una sola vez, al iniciar el servidor o un script.
 * @param {string} uri Cadena de conexión.
 */
export async function conectarBaseDeDatos(uri) {
  // Si MongoDB no responde en 8 s, falla con un error en lugar de quedarse esperando.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  console.log(`[MongoDB] Conectado a la base de datos "${mongoose.connection.name}"`)
}

/**
 * Arranca una base temporal en memoria y se conecta a ella.
 * Sirve para desarrollar sin tener todavía la cuenta de Atlas: los datos
 * se pierden al apagar el servidor.
 */
export async function conectarBaseEnMemoria() {
  // Se importa aquí porque es una dependencia de desarrollo: en producción no está instalada.
  const { MongoMemoryServer } = await import('mongodb-memory-server')
  // El primer arranque puede tardar en un equipo ocupado: se le da un minuto
  servidorEnMemoria = await MongoMemoryServer.create({ instance: { dbName: 'conectatutor', launchTimeout: 60000 } })
  await mongoose.connect(servidorEnMemoria.getUri('conectatutor'))
  console.log('[MongoDB] Base temporal en memoria: los datos se pierden al apagar la API')
}

/** Cierra la conexión (la usan el seed, las pruebas y el apagado del servidor). */
export async function desconectarBaseDeDatos() {
  await mongoose.disconnect()
  if (servidorEnMemoria) {
    await servidorEnMemoria.stop()
    servidorEnMemoria = null
  }
}

/** Indica si la conexión está activa (lo usa la ruta /api/salud). */
export function estaConectada() {
  return mongoose.connection.readyState === 1
}

/** Indica si la base activa es la temporal en memoria. */
export function esBaseEnMemoria() {
  return servidorEnMemoria !== null
}
