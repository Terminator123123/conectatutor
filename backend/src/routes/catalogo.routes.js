import { Router } from 'express'
import {
  crearMateria,
  crearPrograma,
  desactivarMateria,
  editarMateria,
  editarPrograma,
  eliminarPrograma,
  listarMaterias,
  listarProgramas,
  obtenerMateria,
  obtenerPrograma,
} from '../controllers/catalogo.controller.js'
import { autenticar, autenticarSiHayToken, exigirRol } from '../middlewares/autenticar.js'
import { validarId } from '../middlewares/validarId.js'
import { validarCambiosMateria, validarCambiosPrograma, validarNuevaMateria, validarNuevoPrograma } from '../middlewares/validarMateria.js'
import { RolUsuario } from '../utils/enums.js'

const soloAdministrador = [autenticar, exigirRol(RolUsuario.ADMINISTRADOR)]

/** Programas académicos, montado en /api/programas. Leer es público (el registro los necesita); cambiar es del administrador. */
export const programasRouter = Router()
programasRouter.get('/', listarProgramas)
programasRouter.get('/:id', validarId(), obtenerPrograma)
programasRouter.post('/', soloAdministrador, validarNuevoPrograma, crearPrograma)
programasRouter.put('/:id', soloAdministrador, validarId(), validarCambiosPrograma, editarPrograma)
programasRouter.delete('/:id', soloAdministrador, validarId(), eliminarPrograma)

/** Catálogo de materias, montado en /api/materias. Leer es público; cambiar es del administrador. */
export const materiasRouter = Router()
materiasRouter.get('/', autenticarSiHayToken, listarMaterias)
materiasRouter.get('/:id', validarId(), obtenerMateria)
materiasRouter.post('/', soloAdministrador, validarNuevaMateria, crearMateria)
materiasRouter.put('/:id', soloAdministrador, validarId(), validarCambiosMateria, editarMateria)
materiasRouter.delete('/:id', soloAdministrador, validarId(), desactivarMateria)
