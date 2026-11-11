import { app } from './app.js'
import { conectarBaseDeDatos, conectarBaseEnMemoria, desconectarBaseDeDatos } from './config/database.js'
import { env, revisarConfiguracion } from './config/env.js'
import { asegurarIndices } from './models/index.js'
import { cargarSemilla, esClaveAceptable } from './services/semilla.service.js'

/**
 * PUNTO DE ENTRADA DEL BACKEND
 * 1. Revisa la configuración.
 * 2. Conecta con MongoDB (o con una base temporal en memoria si no hay URI en desarrollo).
 * 3. Si la conexión funciona, enciende el servidor HTTP.
 */
async function iniciarServidor() {
  const problemas = revisarConfiguracion()
  if (problemas.length > 0) {
    for (const problema of problemas) console.error(`[Config] ${problema}`)
    console.error('         Copia backend/.env.example como backend/.env y revisa sus valores.')
    process.exit(1)
  }

  try {
    if (env.mongodbUri) {
      await conectarBaseDeDatos(env.mongodbUri)
      await asegurarIndices()
    } else {
      await conectarBaseEnMemoria()
      await asegurarIndices()
      // La base temporal nace vacía: se llenan los datos de demostración.
      if (esClaveAceptable(env.claveDemo)) {
        const totales = await cargarSemilla(env.claveDemo)
        console.log('[Seed] Datos de demostración cargados:', totales)
      } else {
        console.warn('[Seed] CLAVE_DEMO no está definida o es muy débil: la base temporal queda vacía.')
      }
    }

    const servidor = app.listen(env.puerto, () => {
      console.log(`[API] Servidor escuchando en http://localhost:${env.puerto}/api`)
      console.log(`[API] Documentación en http://localhost:${env.puerto}/api/docs`)
    })

    // Cierre ordenado con Ctrl + C o cuando la plataforma detiene el servicio.
    const apagar = async () => {
      servidor.close()
      await desconectarBaseDeDatos()
      process.exit(0)
    }
    process.on('SIGINT', apagar)
    process.on('SIGTERM', apagar)
  } catch (error) {
    console.error('[API] No se pudo iniciar el servidor:', error.message)
    console.error('      ¿Es correcta MONGODB_URI en backend/.env? ¿Atlas permite la conexión desde esta red?')
    await desconectarBaseDeDatos().catch(() => {})
    process.exit(1)
  }
}

iniciarServidor()
