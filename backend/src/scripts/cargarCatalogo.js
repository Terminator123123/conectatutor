import { pathToFileURL } from 'node:url'
import { conectarBaseDeDatos, desconectarBaseDeDatos } from '../config/database.js'
import { env } from '../config/env.js'
import { cargarCatalogoInicial, prepararIndicesDelCatalogo } from '../services/catalogoInicial.service.js'

/**
 * Carga el catálogo académico de Uniguajira (programas y materias) en la base de MONGODB_URI, también la de
 * producción: sin programas, Coordinación no puede crear cuentas de estudiantes ni materias.
 * Solo inserta lo que falta en programas y materias; no cambia lo existente ni otras colecciones, y no crea cuentas
 * ni datos de demostración.
 * Uso desde backend/: npm run cargar-catalogo (ver README, «Catálogo académico inicial»).
 * Los parámetros existen para poder probarlo sin base real.
 * @returns {Promise<number>} Código de salida: 0 si el catálogo quedó completo; 1 si no.
 */
export async function ejecutar({
  configuracion = env,
  conexion = { conectarBaseDeDatos, desconectarBaseDeDatos, asegurarIndices: prepararIndicesDelCatalogo, cargarCatalogoInicial },
  registro = console,
} = {}) {
  if (!configuracion.mongodbUri) {
    registro.error('[Catálogo] Falta MONGODB_URI: indica la base donde se carga el catálogo (en backend/.env o en el entorno).')
    return 1
  }
  try {
    await conexion.conectarBaseDeDatos(configuracion.mongodbUri)
    // Solo los índices del catálogo: son los que impiden duplicar un programa o una materia.
    // No se tocan las demás colecciones (por ejemplo, no se migran las reservas de las sesiones).
    await conexion.asegurarIndices()
    const { programas, materias } = await conexion.cargarCatalogoInicial()
    registro.log(`[Catálogo] Programas: ${programas.creados} creados, ${programas.existentes} ya estaban.`)
    registro.log(`[Catálogo] Materias: ${materias.creadas} creadas, ${materias.existentes} ya estaban.`)
    registro.log('[Catálogo] Listo. Coordinación ya puede crear cuentas de estudiantes y materias.')
    return 0
  } catch (error) {
    registro.error('[Catálogo] No se pudo cargar el catálogo:', error.message)
    return 1
  } finally {
    await conexion.desconectarBaseDeDatos().catch(() => {})
  }
}

// Solo corre al ejecutar `npm run cargar-catalogo`, no al importarlo desde las pruebas
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await ejecutar()
