import { pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import { conectarBaseDeDatos, conectarBaseEnMemoria, desconectarBaseDeDatos } from '../config/database.js'
import { env, revisarConfiguracion } from '../config/env.js'
import { asegurarIndices } from '../models/index.js'
import { cargarSemilla } from '../services/semilla.service.js'

// Un solo servidor local, con usuario y contraseña bien codificados y sin opciones que cambien el destino
const CARACTER_URI = '(?:[^:@/?#[\\]%]|%[0-9A-Fa-f]{2})'
const FORMA_URI_LOCAL = new RegExp(
  `^mongodb://(?:(${CARACTER_URI}+(?::${CARACTER_URI}*)?)@)?(localhost|127\\.0\\.0\\.1|\\[::1\\])(?::(\\d+))?(?:/([^?#]*))?(?:\\?([^#]*))?$`,
  'i',
)
// Opciones con las que el controlador puede terminar en otro servidor: descubrir réplicas, balanceador, SRV o un proxy
const OPCIONES_QUE_CAMBIAN_DESTINO = new Set([
  'replicaset',
  'loadbalanced',
  'srvservicename',
  'srvmaxhosts',
  'proxyhost',
  'proxyport',
  'proxyusername',
  'proxypassword',
])

/** Nombre de la opción tal como lo entiende el controlador: decodificado y sin distinguir mayúsculas. */
function nombreOpcion(opcion) {
  const [nombre = ''] = new URLSearchParams(opcion).keys()
  return nombre.trim().toLowerCase()
}

/** El controlador decodifica usuario y contraseña como UTF-8: se rechazan aquí las secuencias que no lo son (p. ej. %FF). */
function credencialesDecodificables(credenciales) {
  try {
    decodeURIComponent(credenciales)
    return true
  } catch {
    return false
  }
}

/**
 * Indica si la URI apunta a un único servidor de esta misma máquina.
 * La semilla pisa datos de demostración: solo se permite sobre una base local.
 * Rechaza varios servidores, mongodb+srv y las opciones que cambian el destino (replicaSet, loadBalanced,
 * SRV, proxy, directConnection=false), porque con ellas el controlador podría terminar escribiendo en otro servidor.
 * Las demás opciones (TLS, autenticación, tiempos) pasan intactas al controlador, como antes de la guarda.
 * @param {string} uri Cadena de conexión mongodb://
 */
export function esUriLocal(uri) {
  // Espacios y caracteres de control no tienen cabida en una URI local y el controlador los trata de forma imprevisible
  if (typeof uri !== 'string' || /[\u0000-\u0020\u007f-\u009f]/.test(uri)) return false
  const partes = FORMA_URI_LOCAL.exec(uri)
  if (!partes) return false
  if (partes[1] !== undefined && !credencialesDecodificables(partes[1])) return false
  const puerto = partes[3]
  if (puerto !== undefined && !(Number(puerto) >= 1 && Number(puerto) <= 65535)) return false
  for (const [nombre, valor] of new URLSearchParams(partes[5] ?? '')) {
    const clave = nombre.trim().toLowerCase()
    if (OPCIONES_QUE_CAMBIAN_DESTINO.has(clave)) return false
    if (clave === 'directconnection' && valor.trim().toLowerCase() !== 'true') return false
  }
  return destinoDirectoLocal(conConexionDirecta(uri))
}

const SERVIDORES_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * Comprobación final con el analizador del propio controlador, sin conectar: lo que cuenta es cómo entiende la URI,
 * no su texto. Exige un solo servidor local, conexión directa y ninguna opción de réplica, balanceador, SRV o proxy.
 */
function destinoDirectoLocal(uri) {
  try {
    const opciones = new mongoose.mongo.MongoClient(uri).options
    if (opciones.hosts.length !== 1) return false
    const { host, socketPath } = opciones.hosts[0]
    if (socketPath || !SERVIDORES_LOCALES.has(String(host).toLowerCase())) return false
    return opciones.directConnection === true && !opciones.loadBalanced && !opciones.replicaSet && !opciones.srvHost && !opciones.proxyHost
  } catch {
    return false
  }
}

/**
 * Deja directConnection=true como única opción de ese nombre: el controlador no descubre ni cambia de servidor.
 * Se reconstruye la consulta opción por opción; buscar el texto suelto se dejaba engañar por otros valores.
 */
function conConexionDirecta(uri) {
  const [base, ...resto] = uri.split('?')
  const opciones = resto.join('?').split('&').filter((opcion) => opcion && nombreOpcion(opcion) !== 'directconnection')
  return `${base}?${[...opciones, 'directConnection=true'].join('&')}`
}

/**
 * Carga los datos de demostración en la base indicada por MONGODB_URI.
 * Uso: npm run seed
 *
 * Se puede repetir las veces que haga falta: actualiza lo que ya existe y no duplica.
 * Si MONGODB_URI está vacía (solo en desarrollo), lo ejecuta dos veces sobre una
 * base temporal en memoria para comprobar que no duplica; ahí no queda nada guardado.
 *
 * En producción nunca corre, ni sobre una base que no sea local: termina con salida 1 antes de intentar conectarse.
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

  if (configuracion.mongodbUri && !esUriLocal(configuracion.mongodbUri)) {
    registro.error('[Seed] MONGODB_URI no es válida para la semilla: debe apuntar a un único servidor local (localhost, 127.0.0.1 o [::1]): la semilla solo se carga en un servidor local, sin replicaSet, balanceador, SRV, proxy ni directConnection=false.')
    salir(1)
    return
  }

  try {
    if (configuracion.mongodbUri) {
      await conexion.conectarBaseDeDatos(conConexionDirecta(configuracion.mongodbUri))
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
