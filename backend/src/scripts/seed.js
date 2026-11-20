import { pathToFileURL } from 'node:url'
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
 *
 * En producción nunca corre: termina con salida 1 antes de intentar conectarse.
 * Los parámetros existen para poder probarlo con una conexión de mentira.
 */
export async function ejecutar({
  configuracion = env,
  revisar = revisarConfiguracion,
  conexion = { conectarBaseDeDatos, conectarBaseEnMemoria, desconectarBaseDeDatos, asegurarIndices, cargarSemilla },
  salir = (codigo) => process.exit(codigo),
  registro = console,
} = {}) {
  // También se mira el proceso real: una configuración recibida no puede abrir la puerta en producción
  if (configuracion.esProduccion || env.esProduccion) {
    registro.error('[Seed] La carga de datos de demostración no se ejecuta en producción.')
    salir(1)
    return
  }

  const problemas = revisar()
  if (problemas.length > 0) {
    for (const problema of problemas) registro.error(`[Seed] ${problema}`)
    salir(1)
    return
  }

  try {
    if (configuracion.mongodbUri) {
      await conexion.conectarBaseDeDatos(configuracion.mongodbUri)
      await conexion.asegurarIndices()
      const totales = await conexion.cargarSemilla(configuracion.claveDemo)
      registro.log('[Seed] Datos de demostración cargados:', totales)
    } else {
      registro.log('[Seed] MONGODB_URI está vacía: se prueba sobre una base temporal en memoria.')
      await conexion.conectarBaseEnMemoria()
      await conexion.asegurarIndices()
      const primera = await conexion.cargarSemilla(configuracion.claveDemo)
      const segunda = await conexion.cargarSemilla(configuracion.claveDemo)
      registro.log('[Seed] Primera carga:', primera)
      registro.log('[Seed] Segunda carga:', segunda)
      registro.log('[Seed] Nada quedó guardado. Para cargar una base local, define MONGODB_URI en backend/.env.')
    }
  } catch (error) {
    registro.error('[Seed] No se pudieron cargar los datos:', error.message)
    process.exitCode = 1
  } finally {
    await conexion.desconectarBaseDeDatos()
  }
}

// Solo corre al ejecutar `npm run seed`, no al importarlo desde las pruebas
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await ejecutar()
