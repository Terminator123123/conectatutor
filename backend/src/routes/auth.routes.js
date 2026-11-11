import { Router } from 'express'
import { editarPropio, ingresar, obtenerPropio, registrar } from '../controllers/auth.controller.js'
import { autenticar } from '../middlewares/autenticar.js'
import { limitarIngreso } from '../middlewares/limitarIntentos.js'
import { validarEdicionCuenta, validarIngreso, validarRegistro } from '../middlewares/validarAuth.js'

/** Rutas de autenticación, montadas en /api/auth. */
export const authRouter = Router()

authRouter.post('/registro', validarRegistro, registrar)
authRouter.post('/ingreso', validarIngreso, limitarIngreso, ingresar)
authRouter.get('/yo', autenticar, obtenerPropio)
authRouter.patch('/yo', autenticar, validarEdicionCuenta, editarPropio)
