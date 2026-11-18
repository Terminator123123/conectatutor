import { Router } from 'express'
import {
  calificar,
  cancelar,
  confirmar,
  finalizar,
  listar,
  obtener,
  proponerReprogramacion,
  rechazar,
  responderReprogramacion,
  solicitar,
} from '../controllers/sesiones.controller.js'
import { autenticar, exigirRol } from '../middlewares/autenticar.js'
import { validarId } from '../middlewares/validarId.js'
import {
  validarCalificacion,
  validarCancelacion,
  validarFiltrosSesiones,
  validarMotivo,
  validarPropuesta,
  validarRespuesta,
  validarSolicitud,
} from '../middlewares/validarSesion.js'
import { RolUsuario } from '../utils/enums.js'

/** Sesiones de tutoría, montado en /api/sesiones. Todas las rutas exigen sesión iniciada. */
export const sesionesRouter = Router()

const soloEstudiante = exigirRol(RolUsuario.ESTUDIANTE)

sesionesRouter.use(autenticar)

// Consultar: los participantes y la coordinación. Quién puede ver cada sesión lo decide el servicio.
sesionesRouter.get('/', validarFiltrosSesiones, listar)
sesionesRouter.get('/:id', validarId(), obtener)

// Actuar: solo estudiantes. Qué papel (solicitante o tutor) exige cada acción lo decide el servicio.
sesionesRouter.post('/', soloEstudiante, validarSolicitud, solicitar)
sesionesRouter.patch('/:id/confirmar', soloEstudiante, validarId(), confirmar)
sesionesRouter.patch('/:id/rechazar', soloEstudiante, validarId(), validarMotivo, rechazar)
sesionesRouter.patch('/:id/cancelar', soloEstudiante, validarId(), validarCancelacion, cancelar)
sesionesRouter.patch('/:id/finalizar', soloEstudiante, validarId(), finalizar)
sesionesRouter.post('/:id/calificacion', soloEstudiante, validarId(), validarCalificacion, calificar)
sesionesRouter.put('/:id/reprogramacion', soloEstudiante, validarId(), validarPropuesta, proponerReprogramacion)
sesionesRouter.patch('/:id/reprogramacion', soloEstudiante, validarId(), validarRespuesta, responderReprogramacion)
