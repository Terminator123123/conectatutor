import { HttpError } from '../utils/HttpError.js'
import { esIdValido } from './validarId.js'

const esTexto = (valor) => typeof valor === 'string'

/**
 * Revisa los campos de una materia y devuelve los que llegaron, ya limpios.
 * @param {object} cuerpo Cuerpo de la petición.
 * @param {boolean} todosObligatorios true al crear; false al editar (solo lo enviado).
 */
function revisarMateria(cuerpo, todosObligatorios) {
  const errores = []
  const datos = {}

  if (cuerpo.codigo !== undefined || todosObligatorios) {
    const codigo = esTexto(cuerpo.codigo) ? cuerpo.codigo.trim().toUpperCase() : ''
    if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(codigo)) {
      errores.push('El código debe tener entre 2 y 20 caracteres: letras, números y guiones')
    }
    datos.codigo = codigo
  }

  if (cuerpo.nombre !== undefined || todosObligatorios) {
    const nombre = esTexto(cuerpo.nombre) ? cuerpo.nombre.trim().replace(/\s+/g, ' ') : ''
    if (nombre.length < 3 || nombre.length > 120) {
      errores.push('El nombre de la materia debe tener entre 3 y 120 caracteres')
    }
    datos.nombre = nombre
  }

  if (cuerpo.programa !== undefined || todosObligatorios) {
    if (!esIdValido(cuerpo.programa)) errores.push('Selecciona el programa al que pertenece la materia')
    datos.programa = cuerpo.programa
  }

  if (cuerpo.activa !== undefined) {
    if (typeof cuerpo.activa !== 'boolean') errores.push('activa debe ser verdadero o falso')
    datos.activa = cuerpo.activa
  }

  return { errores, datos }
}

/** Valida el cuerpo de POST /api/materias. */
export function validarNuevaMateria(req, _res, next) {
  const { errores, datos } = revisarMateria(req.body ?? {}, true)
  if (errores.length > 0) throw new HttpError(400, 'Los datos de la materia no son válidos', errores)
  delete datos.activa // una materia nueva siempre nace activa
  req.body = datos
  next()
}

/**
 * Revisa los campos de un programa académico y devuelve los que llegaron, ya limpios.
 * @param {object} cuerpo Cuerpo de la petición.
 * @param {boolean} todosObligatorios true al crear; false al editar (solo lo enviado).
 */
function revisarPrograma(cuerpo, todosObligatorios) {
  const errores = []
  const datos = {}
  for (const [campo, etiqueta] of [['nombre', 'El nombre del programa'], ['facultad', 'El nombre de la facultad']]) {
    if (cuerpo[campo] === undefined && !todosObligatorios) continue
    const valor = esTexto(cuerpo[campo]) ? cuerpo[campo].trim().replace(/\s+/g, ' ') : ''
    if (valor.length < 3 || valor.length > 120) errores.push(`${etiqueta} debe tener entre 3 y 120 caracteres`)
    datos[campo] = valor
  }
  return { errores, datos }
}

/** Valida el cuerpo de POST /api/programas. */
export function validarNuevoPrograma(req, _res, next) {
  const { errores, datos } = revisarPrograma(req.body ?? {}, true)
  if (errores.length > 0) throw new HttpError(400, 'Los datos del programa no son válidos', errores)
  req.body = datos
  next()
}

/** Valida el cuerpo de PUT /api/programas/:id: al menos un campo, y solo los conocidos. */
export function validarCambiosPrograma(req, _res, next) {
  const { errores, datos } = revisarPrograma(req.body ?? {}, false)
  if (errores.length === 0 && Object.keys(datos).length === 0) {
    errores.push('Envía al menos un campo para cambiar: nombre o facultad')
  }
  if (errores.length > 0) throw new HttpError(400, 'Los datos del programa no son válidos', errores)
  req.body = datos
  next()
}

/** Valida el cuerpo de PUT /api/materias/:id: al menos un campo, y solo los conocidos. */
export function validarCambiosMateria(req, _res, next) {
  const { errores, datos } = revisarMateria(req.body ?? {}, false)
  if (errores.length === 0 && Object.keys(datos).length === 0) {
    errores.push('Envía al menos un campo para cambiar: codigo, nombre, programa o activa')
  }
  if (errores.length > 0) throw new HttpError(400, 'Los datos de la materia no son válidos', errores)
  req.body = datos
  next()
}
