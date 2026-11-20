import mongoose from 'mongoose'
import { INSTITUCION } from '../config/institucion.js'
import { Administrador, Usuario } from '../models/index.js'
import { esCorreoInstitucional } from '../models/usuario.model.js'
import { cifrarClave, esClaveAceptable, MENSAJE_CLAVE } from '../utils/claves.js'
import { RolUsuario } from '../utils/enums.js'

/**
 * Identificador fijo de la cuenta que crea este alta. Si dos ejecuciones coinciden, el índice único
 * de `_id` deja guardar solo una: nunca quedan dos cuentas creadas por esta vía.
 */
export const ID_COORDINACION_INICIAL = new mongoose.Types.ObjectId('000000000000000000000001')

/**
 * Revisa los datos de la primera cuenta de Coordinación con las reglas del resto de cuentas.
 * @param {{nombre?: unknown, correo?: unknown, clave?: unknown, dependencia?: unknown}} datos
 * @returns {string[]} Problemas encontrados; vacío si los datos sirven.
 */
export function revisarDatosCoordinacion({ nombre, correo, clave, dependencia }) {
  const problemas = []
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : ''
  if (nombreLimpio.length < 3 || nombreLimpio.length > 80) problemas.push('El nombre debe tener entre 3 y 80 caracteres')
  if (!esCorreoInstitucional(correo)) problemas.push(`El correo debe ser institucional (@${INSTITUCION.dominioCorreo})`)
  if (!esClaveAceptable(clave)) problemas.push(MENSAJE_CLAVE)
  if (dependencia !== undefined && (typeof dependencia !== 'string' || !dependencia.trim() || dependencia.trim().length > 160)) {
    problemas.push('La dependencia debe tener entre 1 y 160 caracteres')
  }
  return problemas
}

/**
 * Crea la primera cuenta de Coordinación en una base que no tiene ninguna, por ejemplo la de producción recién
 * creada: allí no hay registro abierto ni datos de demostración, así que nadie podría entrar a crear cuentas.
 * Si ya existe alguna cuenta de Coordinación, no crea otra ni cambia la existente: las demás se gestionan
 * desde la aplicación. La contraseña solo se guarda cifrada.
 * @param {{nombre: string, correo: string, clave: string, dependencia?: string}} datos
 * @returns {Promise<{resultado: 'creada'|'ya-existe'|'correo-en-uso'|'datos-invalidos', correo?: string, problemas?: string[]}>}
 */
export async function crearCoordinacionInicial({ nombre, correo, clave, dependencia = INSTITUCION.dependenciaVerificadora }) {
  const problemas = revisarDatosCoordinacion({ nombre, correo, clave, dependencia })
  if (problemas.length > 0) return { resultado: 'datos-invalidos', problemas }
  const correoInstitucional = correo.trim().toLowerCase()
  if (await Usuario.exists({ tipo: RolUsuario.ADMINISTRADOR })) return { resultado: 'ya-existe' }
  if (await Usuario.exists({ correoInstitucional })) return { resultado: 'correo-en-uso' }
  try {
    await Administrador.create({
      _id: ID_COORDINACION_INICIAL,
      nombre: nombre.trim(),
      correoInstitucional,
      claveHash: await cifrarClave(clave),
      dependencia: dependencia.trim(),
    })
  } catch (error) {
    // Otra ejecución guardó la cuenta entre la comprobación y esta escritura (índice único de _id o de correo)
    if (error?.code !== 11000) throw error
    return { resultado: (await Usuario.exists({ tipo: RolUsuario.ADMINISTRADOR })) ? 'ya-existe' : 'correo-en-uso' }
  }
  return { resultado: 'creada', correo: correoInstitucional }
}
