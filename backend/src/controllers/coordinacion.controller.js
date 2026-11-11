import * as servicio from '../services/coordinacion.service.js'
import { EstadoVerificacion } from '../utils/enums.js'
import { HttpError } from '../utils/HttpError.js'

export async function listarPerfiles(req, res) {
  const estado = typeof req.query.estado === 'string' && req.query.estado !== ''
    ? req.query.estado.toUpperCase()
    : EstadoVerificacion.PENDIENTE
  if (!Object.values(EstadoVerificacion).includes(estado)) {
    throw new HttpError(400, `El filtro estado debe ser uno de: ${Object.values(EstadoVerificacion).join(', ')}`)
  }
  res.status(200).json(await servicio.listarPerfiles(estado))
}

export async function verificarPerfil(req, res) {
  res.status(200).json(await servicio.verificarPerfil(req.params.id))
}

export async function rechazarPerfil(req, res) {
  res.status(200).json(await servicio.rechazarPerfil(req.params.id, req.body.motivo))
}

export async function calcularMetricas(_req, res) {
  res.status(200).json(await servicio.calcularMetricas())
}
