import * as servicioTutores from '../services/tutores.service.js'
import { HttpError } from '../utils/HttpError.js'

/** GET /api/tutores */
export async function buscarTutores(req, res) {
  res.status(200).json(await servicioTutores.buscarTutores(req.filtros))
}

/** GET /api/tutores/mi-perfil */
export async function obtenerMiPerfil(req, res) {
  const perfil = await servicioTutores.obtenerMiPerfil(req.usuario._id)
  if (!perfil) throw new HttpError(404, 'Todavía no has activado tu perfil de tutor')
  res.status(200).json(perfil)
}

/** PUT /api/tutores/mi-perfil */
export async function guardarMiPerfil(req, res) {
  const { perfil, creado } = await servicioTutores.guardarMiPerfil(req.usuario._id, req.body)
  res.status(creado ? 201 : 200).json(perfil)
}

/** GET /api/tutores/:id */
export async function obtenerDetalle(req, res) {
  res.status(200).json(await servicioTutores.obtenerDetalle(req.params.id, req.usuario))
}
