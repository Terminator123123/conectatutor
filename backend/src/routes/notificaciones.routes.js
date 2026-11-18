import { Router } from 'express'
import { autenticar, exigirRol } from '../middlewares/autenticar.js'
import * as servicio from '../services/notificaciones.service.js'
import { RolUsuario } from '../utils/enums.js'

/** Campana de notificaciones (RQF022), montada en /api/notificaciones. Solo estudiantes. */
export const notificacionesRouter = Router()

notificacionesRouter.use(autenticar, exigirRol(RolUsuario.ESTUDIANTE))

notificacionesRouter.get('/', async (req, res) => {
  res.status(200).json(await servicio.listar(req.usuario))
})

notificacionesRouter.patch('/leidas', async (req, res) => {
  await servicio.marcarLeidas(req.usuario)
  res.status(204).end()
})
