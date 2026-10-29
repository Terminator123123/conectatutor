// Comparte una única instancia del repositorio y del servicio de autenticación.
import { INSTITUCION } from '../config/institucion.js'
import ServicioAutenticacion from './ServicioAutenticacion.js'
import { crearRepositorio } from './repositorio.js'

export const repositorio = crearRepositorio()
export const servicioAutenticacion = new ServicioAutenticacion(
  repositorio, INSTITUCION.dominioCorreo, INSTITUCION.sedes,
)
