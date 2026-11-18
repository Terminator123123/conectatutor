import * as servicioSesiones from '../services/sesiones.service.js'

/** POST /api/sesiones */
export async function solicitar(req, res) {
  res.status(201).json(await servicioSesiones.solicitar(req.usuario, req.body))
}

/** GET /api/sesiones */
export async function listar(req, res) {
  res.status(200).json(await servicioSesiones.listar(req.usuario, req.filtros))
}

/** GET /api/sesiones/:id */
export async function obtener(req, res) {
  res.status(200).json(await servicioSesiones.obtener(req.params.id, req.usuario))
}

/** PATCH /api/sesiones/:id/confirmar */
export async function confirmar(req, res) {
  res.status(200).json(await servicioSesiones.confirmar(req.params.id, req.usuario))
}

/** PATCH /api/sesiones/:id/rechazar */
export async function rechazar(req, res) {
  res.status(200).json(await servicioSesiones.rechazar(req.params.id, req.usuario, req.body.motivo))
}

/** PATCH /api/sesiones/:id/cancelar */
export async function cancelar(req, res) {
  res.status(200).json(await servicioSesiones.cancelar(req.params.id, req.usuario, req.body))
}

/** PATCH /api/sesiones/:id/finalizar */
export async function finalizar(req, res) {
  res.status(200).json(await servicioSesiones.finalizar(req.params.id, req.usuario))
}

/** POST /api/sesiones/:id/calificacion */
export async function calificar(req, res) {
  res.status(201).json(await servicioSesiones.calificar(req.params.id, req.usuario, req.body))
}

/** PUT /api/sesiones/:id/reprogramacion */
export async function proponerReprogramacion(req, res) {
  res.status(200).json(await servicioSesiones.proponerReprogramacion(req.params.id, req.usuario, req.body))
}

/** PATCH /api/sesiones/:id/reprogramacion */
export async function responderReprogramacion(req, res) {
  res.status(200).json(await servicioSesiones.responderReprogramacion(req.params.id, req.usuario, req.body.acepta))
}

/** GET /api/tutores/:id/ocupacion */
export async function listarOcupacion(req, res) {
  res.status(200).json(await servicioSesiones.listarOcupacion(req.params.id))
}
