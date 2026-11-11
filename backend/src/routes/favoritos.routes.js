import { Router } from 'express'
import * as controlador from '../controllers/favoritos.controller.js'
import { autenticar, exigirRol } from '../middlewares/autenticar.js'
import { validarId } from '../middlewares/validarId.js'
import { RolUsuario } from '../utils/enums.js'

/** Tutores favoritos del estudiante (RQF030), montado en /api/favoritos. */
export const favoritosRouter = Router()

favoritosRouter.use(autenticar, exigirRol(RolUsuario.ESTUDIANTE))

favoritosRouter.get('/', controlador.listar)
favoritosRouter.put('/:id', validarId(), controlador.agregar)
favoritosRouter.delete('/:id', validarId(), controlador.quitar)
