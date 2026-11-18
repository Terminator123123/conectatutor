import { anotarIngresoFallido, olvidarIngresosFallidos } from '../middlewares/limitarIntentos.js'
import * as servicioAuth from '../services/auth.service.js'
import * as servicioRecuperacion from '../services/recuperacion.service.js'

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

/** POST /api/auth/recuperacion */
export async function pedirRecuperacion(req, res) {
  await servicioRecuperacion.solicitarRecuperacion(req.body.correoInstitucional)
  res.status(202).json({ mensaje: 'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva' })
}

/** POST /api/auth/recuperacion/comprobar */
export async function comprobarRecuperacion(req, res) {
  await servicioRecuperacion.comprobarEnlace(req.body?.token)
  res.status(200).json({ vigente: true })
}

/** POST /api/auth/recuperacion/restablecer */
export async function restablecerClave(req, res) {
  await servicioRecuperacion.restablecerClave(req.body.token, req.body.clave)
  res.status(200).json({ mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión' })
}
