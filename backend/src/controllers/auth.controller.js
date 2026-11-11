import { anotarIngresoFallido, olvidarIngresosFallidos } from '../middlewares/limitarIntentos.js'
import * as servicioAuth from '../services/auth.service.js'

// Los controladores solo traducen entre HTTP y los servicios: leen la petición,
// llaman al servicio y arman la respuesta. Las reglas viven en el servicio.

/** POST /api/auth/registro */
export async function registrar(req, res) {
  const resultado = await servicioAuth.registrar(req.body)
  res.status(201).json(resultado)
}

/** POST /api/auth/ingreso */
export async function ingresar(req, res) {
  try {
    const resultado = await servicioAuth.ingresar(req.body)
    olvidarIngresosFallidos(req)
    res.status(200).json(resultado)
  } catch (error) {
    if (error?.status === 401) anotarIngresoFallido(req)
    throw error
  }
}

/** GET /api/auth/yo */
export async function obtenerPropio(req, res) {
  res.status(200).json({ usuario: await servicioAuth.presentarUsuario(req.usuario) })
}

/** PATCH /api/auth/yo */
export async function editarPropio(req, res) {
  res.status(200).json({ usuario: await servicioAuth.editarCuenta(req.usuario, req.body) })
}
