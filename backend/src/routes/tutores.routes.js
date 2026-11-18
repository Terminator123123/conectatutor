import { Router } from 'express'
import { listarOcupacion } from '../controllers/sesiones.controller.js'
import { buscarTutores, guardarMiPerfil, obtenerDetalle, obtenerMiPerfil } from '../controllers/tutores.controller.js'
import { autenticar, autenticarSiHayToken, exigirRol } from '../middlewares/autenticar.js'
import { validarId } from '../middlewares/validarId.js'
import { validarBusquedaTutores, validarPerfilTutor } from '../middlewares/validarTutor.js'
import { RolUsuario } from '../utils/enums.js'

/**
 * Tutores, montado en /api/tutores. Buscar y ver un perfil verificado es público,
 * para que el visitante explore antes de crear cuenta; el perfil propio exige sesión.
 */
export const tutoresRouter = Router()

tutoresRouter.get('/', autenticarSiHayToken, validarBusquedaTutores, buscarTutores)

// "mi-perfil" va antes que "/:id" para que no se tome como un identificador.
// No lleva id en la ruta: el perfil es siempre el de quien tiene la sesión.
tutoresRouter.get('/mi-perfil', autenticar, exigirRol(RolUsuario.ESTUDIANTE), obtenerMiPerfil)
tutoresRouter.put('/mi-perfil', autenticar, exigirRol(RolUsuario.ESTUDIANTE), validarPerfilTutor, guardarMiPerfil)

tutoresRouter.get('/:id', autenticarSiHayToken, validarId(), obtenerDetalle)
tutoresRouter.get('/:id/ocupacion', autenticarSiHayToken, validarId(), listarOcupacion)
