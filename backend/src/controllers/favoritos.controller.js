import * as servicio from '../services/favoritos.service.js'

export async function listar(req, res) {
  res.status(200).json(await servicio.listar(req.usuario._id))
}

export async function agregar(req, res) {
  res.status(200).json(await servicio.agregar(req.usuario._id, req.params.id))
}

export async function quitar(req, res) {
  res.status(200).json(await servicio.quitar(req.usuario._id, req.params.id))
}
