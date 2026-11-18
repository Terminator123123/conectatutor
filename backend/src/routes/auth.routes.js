import { Router } from 'express'
import {
  comprobarRecuperacion, editarPropio, ingresar, obtenerPropio, pedirRecuperacion, registrar, restablecerClave,
} from '../controllers/auth.controller.js'
import { cambiarClave, completarPrimerAcceso, guardarFoto, quitarFoto, verFoto } from '../controllers/cuenta.controller.js'
import { autenticar } from '../middlewares/autenticar.js'
import { validarId } from '../middlewares/validarId.js'
import { limitarIngreso, limitarRecuperacion } from '../middlewares/limitarIntentos.js'
import {
  validarCambioClave, validarEdicionCuenta, validarIngreso, validarPrimerAcceso, validarRegistro, validarRestablecimiento,
  validarSolicitudRecuperacion,
} from '../middlewares/validarAuth.js'

/** Rutas de autenticación, montadas en /api/auth. */
export const authRouter = Router()

authRouter.post('/registro', validarRegistro, registrar)
authRouter.post('/ingreso', validarIngreso, limitarIngreso, ingresar)
authRouter.get('/yo', autenticar, obtenerPropio)
authRouter.patch('/yo', autenticar, validarEdicionCuenta, editarPropio)
authRouter.post('/recuperacion', validarSolicitudRecuperacion, limitarRecuperacion, pedirRecuperacion)
authRouter.post('/recuperacion/comprobar', comprobarRecuperacion)
authRouter.post('/recuperacion/restablecer', validarRestablecimiento, restablecerClave)
authRouter.post('/yo/primer-acceso', autenticar, validarPrimerAcceso, completarPrimerAcceso)
authRouter.put('/yo/clave', autenticar, validarCambioClave, cambiarClave)
authRouter.put('/yo/foto', autenticar, guardarFoto)
authRouter.delete('/yo/foto', autenticar, quitarFoto)

/** Fotos de perfil, montado en /api/usuarios. Públicas: acompañan perfiles que ya son públicos. */
export const usuariosRouter = Router()
usuariosRouter.get('/:id/foto', validarId(), verFoto)
