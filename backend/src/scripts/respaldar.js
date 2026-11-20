import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { conectarBaseDeDatos, desconectarBaseDeDatos } from '../config/database.js'
import { env } from '../config/env.js'
import { exportarRespaldo, leerRespaldo } from '../services/respaldo.service.js'

/** Carpeta de respaldos por defecto: backend/respaldos (ignorada por git). */
export const CARPETA_POR_DEFECTO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'respaldos')

/**
 * Respaldo de la base (RQNF010): exporta las colecciones de MONGODB_URI a una carpeta nueva con fecha y hora,
 * y después la vuelve a leer para comprobar que quedó completa. El plan gratuito de Atlas no hace copias
 * automáticas: este comando se programa en el sistema (ver README, «Respaldo de la base»).
 * Uso desde backend/: npm run respaldar. RESPALDO_CARPETA cambia la carpeta de destino.
 * No escribe en la base ni muestra datos: solo la carpeta y cuántos documentos guardó de cada colección.
 * Los parámetros existen para poder probarlo sin base real.
 * @returns {Promise<number>} Código de salida: 0 si el respaldo quedó completo; 1 si no.
 */
export async function ejecutar({
  entorno = process.env,
  configuracion = env,
  conexion = { conectarBaseDeDatos, desconectarBaseDeDatos, exportarRespaldo, leerRespaldo },
  registro = console,
} = {}) {
  if (!configuracion.mongodbUri) {
    registro.error('[Respaldo] Falta MONGODB_URI: indica la base que se respalda (en backend/.env o en el entorno).')
    return 1
  }
  const carpetaBase = entorno.RESPALDO_CARPETA?.trim() ? path.resolve(entorno.RESPALDO_CARPETA.trim()) : CARPETA_POR_DEFECTO
  try {
    await conexion.conectarBaseDeDatos(configuracion.mongodbUri)
    const { carpeta, colecciones } = await conexion.exportarRespaldo({ carpetaBase })
    // Se comprueba lo escrito antes de darlo por bueno
    await conexion.leerRespaldo(carpeta)
    registro.log(`[Respaldo] Respaldo completo en ${carpeta}`)
    for (const [nombre, total] of Object.entries(colecciones)) registro.log(`[Respaldo]   ${nombre}: ${total}`)
    registro.log('[Respaldo] Contiene datos personales y contraseñas cifradas: guárdalo en un lugar privado, fuera del repositorio.')
    return 0
  } catch (error) {
    registro.error('[Respaldo] No se pudo completar el respaldo:', error.message)
    return 1
  } finally {
    await conexion.desconectarBaseDeDatos().catch(() => {})
  }
}

// Solo corre al ejecutar `npm run respaldar`, no al importarlo desde las pruebas
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await ejecutar()
