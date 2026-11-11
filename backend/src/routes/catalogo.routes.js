import { Router } from 'express'
import {
  crearMateria,
  desactivarMateria,
  editarMateria,
  listarMaterias,
  listarProgramas,
  obtenerMateria,
} from '../controllers/catalogo.controller.js'
import { autenticar, autenticarSiHayToken, exigirRol } from '../middlewares/autenticar.js'
import { validarId } from '../middlewares/validarId.js'
import { validarCambiosMateria, validarNuevaMateria } from '../middlewares/validarMateria.js'
import { RolUsuario } from '../utils/enums.js'

const soloAdministrador = [autenticar, exigirRol(RolUsuario.ADMINISTRADOR)]

/** Programas académicos, montado en /api/programas. Lectura pública: el registro los necesita. */
export const programasRouter = Router()
programasRouter.get('/', listarProgramas)

/** Catálogo de materias, montado en /api/materias. Leer es público; cambiar es del administrador. */
export const materiasRouter = Router()
materiasRouter.get('/', autenticarSiHayToken, listarMaterias)
materiasRouter.get('/:id', validarId(), obtenerMateria)
materiasRouter.post('/', soloAdministrador, validarNuevaMateria, crearMateria)
materiasRouter.put('/:id', soloAdministrador, validarId(), validarCambiosMateria, editarMateria)
materiasRouter.delete('/:id', soloAdministrador, validarId(), desactivarMateria)
