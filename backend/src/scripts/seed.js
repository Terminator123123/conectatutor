import { conectarBaseDeDatos, conectarBaseEnMemoria, desconectarBaseDeDatos } from '../config/database.js'
import { env, revisarConfiguracion } from '../config/env.js'
import { asegurarIndices } from '../models/index.js'
import { cargarSemilla } from '../services/semilla.service.js'

/**
 * Carga los datos de demostración en la base indicada por MONGODB_URI.
 * Uso: npm run seed
 *
 * Se puede repetir las veces que haga falta: actualiza lo que ya existe y no duplica.
 * Si MONGODB_URI está vacía (solo en desarrollo), lo ejecuta dos veces sobre una
 * base temporal en memoria para comprobar que no duplica; ahí no queda nada guardado.
 */
async function ejecutar() {
  const problemas = revisarConfiguracion()
  if (problemas.length > 0) {
    for (const problema of problemas) console.error(`[Seed] ${problema}`)
    process.exit(1)
  }

  try {
    if (env.mongodbUri) {
      await conectarBaseDeDatos(env.mongodbUri)
      await asegurarIndices()
      const totales = await cargarSemilla(env.claveDemo)
      console.log('[Seed] Datos de demostración cargados:', totales)
    } else {
      console.log('[Seed] MONGODB_URI está vacía: se prueba sobre una base temporal en memoria.')
      await conectarBaseEnMemoria()
      await asegurarIndices()
      const primera = await cargarSemilla(env.claveDemo)
      const segunda = await cargarSemilla(env.claveDemo)
      console.log('[Seed] Primera carga:', primera)
      console.log('[Seed] Segunda carga:', segunda)
      console.log('[Seed] Nada quedó guardado. Para cargar la base real, define MONGODB_URI en backend/.env.')
    }
  } catch (error) {
    console.error('[Seed] No se pudieron cargar los datos:', error.message)
    process.exitCode = 1
  } finally {
    await desconectarBaseDeDatos()
  }
}

ejecutar()
