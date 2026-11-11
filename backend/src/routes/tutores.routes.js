import { Router } from 'express'
import { buscarTutores, guardarMiPerfil, obtenerDetalle, obtenerMiPerfil } from '../controllers/tutores.controller.js'
import { autenticar, exigirRol } from '../middlewares/autenticar.js'
import { validarId } from '../middlewares/validarId.js'
import { validarBusquedaTutores, validarPerfilTutor } from '../middlewares/validarTutor.js'
import { RolUsuario } from '../utils/enums.js'

/** Tutores, montado en /api/tutores. Todas las rutas exigen sesión. */
export const tutoresRouter = Router()

tutoresRouter.use(autenticar)

tutoresRouter.get('/', validarBusquedaTutores, buscarTutores)

// "mi-perfil" va antes que "/:id" para que no se tome como un identificador.
// No lleva id en la ruta: el perfil es siempre el de quien tiene la sesión.
tutoresRouter.get('/mi-perfil', exigirRol(RolUsuario.ESTUDIANTE), obtenerMiPerfil)
tutoresRouter.put('/mi-perfil', exigirRol(RolUsuario.ESTUDIANTE), validarPerfilTutor, guardarMiPerfil)

tutoresRouter.get('/:id', validarId(), obtenerDetalle)
