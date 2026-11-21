import { INSTITUCION } from '../config/institucion.js'
import ServicioAutenticacionApi from './ServicioAutenticacionApi.js'
import { crearClienteApi } from './api.js'
import { crearRepositorioApi } from './repositorioApi.js'

const escuchas = new Set()
const cliente = crearClienteApi({ alExpirarSesion: (motivo) => escuchas.forEach((escuchar) => escuchar(motivo)) })

export function suscribirExpiracionSesion(escuchar) {
  escuchas.add(escuchar)
  return () => escuchas.delete(escuchar)
}

export const repositorio = crearRepositorioApi({ cliente })
export const servicioAutenticacion = new ServicioAutenticacionApi(
  repositorio, INSTITUCION.dominioCorreo,
)
