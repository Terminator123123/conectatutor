import { env } from '../config/env.js'
import { rutaNoEncontrada } from './manejarErrores.js'

/**
 * Cierra una ruta de uso solo local: en producción responde 404 como si no existiera.
 * Va antes de los analizadores del cuerpo para que ni un JSON mal escrito llegue a otra respuesta.
 * @param {{ esProduccion: boolean }} [entorno] Configuración; por defecto la real.
 */
export function cerrarEnProduccion(entorno = env) {
  return (req, res, siguiente) => (entorno.esProduccion ? rutaNoEncontrada(req, res, siguiente) : siguiente())
}
