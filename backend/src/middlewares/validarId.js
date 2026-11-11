import mongoose from 'mongoose'
import { HttpError } from '../utils/HttpError.js'

/**
 * Comprueba que un parámetro de la ruta sea un id de MongoDB bien formado
 * (24 caracteres hexadecimales) antes de consultar la base de datos.
 * @param {string} [nombre='id'] Nombre del parámetro en la ruta.
 */
export function validarId(nombre = 'id') {
  return function comprobarId(req, _res, next) {
    const valor = req.params[nombre]
    if (typeof valor !== 'string' || !/^[0-9a-fA-F]{24}$/.test(valor) || !mongoose.isValidObjectId(valor)) {
      throw new HttpError(400, `El identificador "${valor}" no es válido`)
    }
    next()
  }
}

/**
 * Indica si un valor es un id de MongoDB escrito como texto.
 * @param {unknown} valor
 * @returns {boolean}
 */
export function esIdValido(valor) {
  return typeof valor === 'string' && /^[0-9a-fA-F]{24}$/.test(valor)
}
