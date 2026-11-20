import { pathToFileURL } from 'node:url'
import { conectarBaseDeDatos, desconectarBaseDeDatos } from '../config/database.js'
import { env } from '../config/env.js'
import { asegurarIndices } from '../models/index.js'
import { crearCoordinacionInicial, revisarDatosCoordinacion } from '../services/coordinacionInicial.service.js'

/**
 * Pide la contraseña en la terminal sin mostrarla. Devuelve null sin terminal interactiva o si se cancela.
 * @param {NodeJS.ReadStream} entrada
 * @param {NodeJS.WriteStream} salida
 * @param {string} pregunta
 * @returns {Promise<string|null>}
 */
export function leerClaveOculta(entrada, salida, pregunta) {
  if (!entrada.isTTY || typeof entrada.setRawMode !== 'function') return Promise.resolve(null)
  salida.write(pregunta)
  entrada.setRawMode(true)
  entrada.resume()
  entrada.setEncoding('utf8')
  return new Promise((resolver) => {
    let clave = ''
    const terminar = (valor) => {
      entrada.off('data', teclear)
      entrada.setRawMode(false)
      entrada.pause()
      salida.write('\n')
      resolver(valor)
    }
    function teclear(texto) {
      for (const caracter of texto) {
        if (caracter === '\r' || caracter === '\n') return terminar(clave)
        if (caracter === '\u0003' || caracter === '\u0004') return terminar(null) // Ctrl+C o Ctrl+D: se cancela
        if (caracter === '\u007f' || caracter === '\b') clave = [...clave].slice(0, -1).join('')
        else if (caracter >= ' ') clave += caracter
      }
    }
    entrada.on('data', teclear)
  })
}

/**
 * Crea la primera cuenta de Coordinación en la base de MONGODB_URI (por ejemplo, la de producción).
 * Uso desde backend/: ver la sección «Primera cuenta de Coordinación» del README.
 *
 * Nombre y correo llegan en COORDINACION_NOMBRE y COORDINACION_CORREO (COORDINACION_DEPENDENCIA es opcional).
 * La contraseña se pide en la terminal sin mostrarla, o se toma de COORDINACION_CLAVE; nunca se escribe en
 * pantalla ni en el registro. Si la base ya tiene una cuenta de Coordinación, no crea otra.
 * Los parámetros existen para poder probarlo sin terminal ni base real.
 * @returns {Promise<number>} Código de salida: 0 si creó la cuenta; 1 en cualquier otro caso.
 */
export async function ejecutar({
  entorno = process.env,
  configuracion = env,
  conexion = { conectarBaseDeDatos, desconectarBaseDeDatos, asegurarIndices, crearCoordinacionInicial },
  pedirClave = (pregunta) => leerClaveOculta(process.stdin, process.stdout, pregunta),
  registro = console,
} = {}) {
  if (!configuracion.mongodbUri) {
    registro.error('[Coordinación] Falta MONGODB_URI: indica la base donde se crea la cuenta (en backend/.env o en el entorno).')
    return 1
  }
  const datos = {
    nombre: entorno.COORDINACION_NOMBRE,
    correo: entorno.COORDINACION_CORREO,
    clave: entorno.COORDINACION_CLAVE,
    dependencia: entorno.COORDINACION_DEPENDENCIA?.trim() ? entorno.COORDINACION_DEPENDENCIA : undefined,
  }
  if (!datos.clave) {
    const clave = await pedirClave('Contraseña de la cuenta de Coordinación (no se muestra): ')
    if (clave === null) {
      registro.error('[Coordinación] No se pudo pedir la contraseña (no hay terminal o se canceló). También puedes definirla en COORDINACION_CLAVE.')
      return 1
    }
    const repetida = await pedirClave('Repite la contraseña: ')
    if (repetida !== clave) {
      registro.error(repetida === null ? '[Coordinación] Se canceló. No se creó la cuenta.' : '[Coordinación] Las contraseñas no coinciden. No se creó la cuenta.')
      return 1
    }
    datos.clave = clave
  }
  // Se revisan los datos antes de conectarse: con datos inválidos no se toca la base
  const problemas = revisarDatosCoordinacion(datos)
  if (problemas.length > 0) {
    for (const problema of problemas) registro.error(`[Coordinación] ${problema}`)
    registro.error('[Coordinación] Revisa COORDINACION_NOMBRE, COORDINACION_CORREO, la contraseña y COORDINACION_DEPENDENCIA.')
    return 1
  }

  try {
    await conexion.conectarBaseDeDatos(configuracion.mongodbUri)
    await conexion.asegurarIndices()
    const { resultado, correo } = await conexion.crearCoordinacionInicial(datos)
    if (resultado === 'creada') {
      registro.log(`[Coordinación] Cuenta creada para ${correo}. Ingresa con ella y crea las cuentas de los estudiantes en «Cuentas».`)
      return 0
    }
    registro.error(resultado === 'ya-existe'
      ? '[Coordinación] Esta base ya tiene una cuenta de Coordinación: no se creó otra.'
      : '[Coordinación] Ese correo ya pertenece a otra cuenta. No se creó la cuenta.')
    return 1
  } catch (error) {
    registro.error('[Coordinación] No se pudo crear la cuenta:', error.message)
    return 1
  } finally {
    await conexion.desconectarBaseDeDatos().catch(() => {})
  }
}

// Solo corre al ejecutar `npm run crear-coordinacion`, no al importarlo desde las pruebas
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await ejecutar()
