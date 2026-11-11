import * as servicioCatalogo from '../services/catalogo.service.js'
import { RolUsuario } from '../utils/enums.js'
import { HttpError } from '../utils/HttpError.js'
import { esIdValido } from '../middlewares/validarId.js'

/** GET /api/programas */
export async function listarProgramas(_req, res) {
  res.status(200).json(await servicioCatalogo.listarProgramas())
}

/** GET /api/materias?programa=&incluirInactivas=true */
export async function listarMaterias(req, res) {
  const { programa, incluirInactivas } = req.query
  if (programa !== undefined && !esIdValido(programa)) {
    throw new HttpError(400, 'El programa indicado en el filtro no es válido')
  }
  // Las materias retiradas solo las ve el administrador.
  const esAdministrador = req.usuario?.tipo === RolUsuario.ADMINISTRADOR
  const materias = await servicioCatalogo.listarMaterias({
    programa,
    incluirInactivas: esAdministrador && incluirInactivas === 'true',
  })
  res.status(200).json(materias)
}

/** GET /api/materias/:id */
export async function obtenerMateria(req, res) {
  res.status(200).json(await servicioCatalogo.obtenerMateria(req.params.id))
}

/** POST /api/materias */
export async function crearMateria(req, res) {
  res.status(201).json(await servicioCatalogo.crearMateria(req.body))
}

/** PUT /api/materias/:id */
export async function editarMateria(req, res) {
  res.status(200).json(await servicioCatalogo.editarMateria(req.params.id, req.body))
}

/** DELETE /api/materias/:id */
export async function desactivarMateria(req, res) {
  res.status(200).json(await servicioCatalogo.desactivarMateria(req.params.id))
}
