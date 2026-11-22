import { Router } from 'express'
import {
  crearFacultad,
  crearMateria,
  crearPrograma,
  desactivarMateria,
  editarFacultad,
  editarMateria,
  editarPrograma,
  eliminarFacultad,
  eliminarPrograma,
  listarFacultades,
  listarMaterias,
  listarProgramas,
  obtenerFacultad,
  obtenerMateria,
  obtenerPrograma,
} from '../controllers/catalogo.controller.js'
import { autenticar, autenticarSiHayToken, exigirRol } from '../middlewares/autenticar.js'
import { validarId } from '../middlewares/validarId.js'
import {
  validarCambiosMateria,
  validarCambiosPrograma,
  validarFacultad,
  validarNuevaMateria,
  validarNuevoPrograma,
} from '../middlewares/validarMateria.js'
import { RolUsuario } from '../utils/enums.js'

const soloAdministrador = [autenticar, exigirRol(RolUsuario.ADMINISTRADOR)]

/** Facultades, montado en /api/facultades. Leer es público; cambiar es del administrador. */
export const facultadesRouter = Router()
facultadesRouter.get('/', listarFacultades)
facultadesRouter.get('/:id', validarId(), obtenerFacultad)
facultadesRouter.post('/', soloAdministrador, validarFacultad, crearFacultad)
facultadesRouter.put('/:id', soloAdministrador, validarId(), validarFacultad, editarFacultad)
facultadesRouter.delete('/:id', soloAdministrador, validarId(), eliminarFacultad)

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
