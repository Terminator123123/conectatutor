import { presentarUsuario } from '../services/auth.service.js'
import * as servicioCuenta from '../services/cuenta.service.js'
import { Usuario } from '../models/index.js'

/** POST /api/auth/yo/primer-acceso */
export async function completarPrimerAcceso(req, res) {
  await servicioCuenta.completarPrimerAcceso(req.usuario._id, req.body)
  res.status(200).json({ usuario: await presentarUsuario(await Usuario.findById(req.usuario._id)) })
}

/** PUT /api/auth/yo/clave */
export async function cambiarClave(req, res) {
  await servicioCuenta.cambiarClave(req.usuario._id, req.body.claveActual, req.body.claveNueva)
  res.status(200).json({ mensaje: 'Contraseña actualizada' })
}

/** PUT /api/auth/yo/foto */
export async function guardarFoto(req, res) {
  await servicioCuenta.guardarFoto(req.usuario._id, req.body?.imagen)
  res.status(200).json({ mensaje: 'Foto actualizada' })
}

/** DELETE /api/auth/yo/foto */
export async function quitarFoto(req, res) {
  await servicioCuenta.quitarFoto(req.usuario._id)
  res.status(204).end()
}

/** GET /api/usuarios/:id/foto — 204 si no tiene foto, para que el navegador muestre las iniciales. */
export async function verFoto(req, res) {
  // La imagen se muestra desde el frontend, que vive en otro origen (también la respuesta vacía).
  res.set('Cross-Origin-Resource-Policy', 'cross-origin')
  const foto = await servicioCuenta.obtenerFoto(req.params.id)
  if (!foto) { res.status(204).end(); return }
  const etiqueta = `"${foto.actualizada.getTime()}"`
  res.set({ 'Cache-Control': 'no-cache', ETag: etiqueta, 'Content-Type': foto.tipo, 'X-Content-Type-Options': 'nosniff' })
  if (req.get('if-none-match') === etiqueta) { res.status(304).end(); return }
  res.status(200).send(foto.datos)
}
