import { Router } from 'express'
import * as controlador from '../controllers/coordinacion.controller.js'
import { autenticar, exigirRol } from '../middlewares/autenticar.js'
import { validarId } from '../middlewares/validarId.js'
import { validarMotivo } from '../middlewares/validarSesion.js'
import { validarNuevaCuenta } from '../middlewares/validarAuth.js'
import { RolUsuario } from '../utils/enums.js'

/** Coordinación, montado en /api/coordinacion. Todo es exclusivo del administrador. */
export const coordinacionRouter = Router()

coordinacionRouter.use(autenticar, exigirRol(RolUsuario.ADMINISTRADOR))

coordinacionRouter.get('/perfiles', controlador.listarPerfiles)
coordinacionRouter.patch('/perfiles/:id/verificar', validarId(), controlador.verificarPerfil)
coordinacionRouter.patch('/perfiles/:id/rechazar', validarId(), validarMotivo, controlador.rechazarPerfil)
coordinacionRouter.post('/cuentas', validarNuevaCuenta, controlador.crearCuenta)
coordinacionRouter.get('/metricas', controlador.calcularMetricas)
