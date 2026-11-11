import mongoose from 'mongoose'
import { INSTITUCION } from '../config/institucion.js'
import { esCorreoInstitucional } from '../models/usuario.model.js'
import { esClaveAceptable, MENSAJE_CLAVE } from '../utils/claves.js'
import { RolUsuario } from '../utils/enums.js'
import { HttpError } from '../utils/HttpError.js'

const esTexto = (valor) => typeof valor === 'string'

/**
 * Revisa el cuerpo de POST /api/auth/registro y lo deja limpio en req.body.
 * Solo pasan los campos esperados y con el tipo correcto: así no se puede
 * colar un rol, un estado ni un operador de consulta de MongoDB.
 */
export function validarRegistro(req, _res, next) {
  const cuerpo = req.body ?? {}
  const errores = []

  const nombre = esTexto(cuerpo.nombre) ? cuerpo.nombre.trim().replace(/\s+/g, ' ') : ''
  if (nombre.replace(/\s/g, '').length < 3 || nombre.length > 80) {
    errores.push('Escribe tu nombre completo (entre 3 y 80 caracteres)')
  }

  const correoInstitucional = esTexto(cuerpo.correoInstitucional) ? cuerpo.correoInstitucional.trim().toLowerCase() : ''
  if (!esCorreoInstitucional(correoInstitucional)) {
    errores.push(`Usa tu correo institucional (@${INSTITUCION.dominioCorreo})`)
  }

  if (!esClaveAceptable(cuerpo.clave)) errores.push(MENSAJE_CLAVE)

  const semestre = cuerpo.semestre
  if (!Number.isInteger(semestre) || semestre < 1 || semestre > INSTITUCION.semestreMaximo) {
    errores.push(`El semestre debe ser un número entero entre 1 y ${INSTITUCION.semestreMaximo}`)
  }

  if (!INSTITUCION.sedes.includes(cuerpo.sede)) {
    errores.push(`Selecciona una sede: ${INSTITUCION.sedes.join(', ')}`)
  }

  if (!esTexto(cuerpo.programa) || !mongoose.isValidObjectId(cuerpo.programa)) {
    errores.push('Selecciona un programa académico')
  }

  // RQNF009 (Ley 1581 de 2012): sin consentimiento expreso no se crea la cuenta.
  if (cuerpo.aceptaTratamientoDatos !== true) {
    errores.push('Debes aceptar el tratamiento de tus datos personales para crear la cuenta')
  }

  if (cuerpo.quiereSerTutor !== undefined && typeof cuerpo.quiereSerTutor !== 'boolean') {
    errores.push('quiereSerTutor debe ser verdadero o falso')
  }

  if (errores.length > 0) {
    throw new HttpError(400, 'Los datos de registro no son válidos', errores)
  }

  req.body = {
    nombre,
    correoInstitucional,
    clave: cuerpo.clave,
    semestre,
    sede: cuerpo.sede,
    programa: cuerpo.programa,
    quiereSerTutor: cuerpo.quiereSerTutor === true,
  }
  next()
}

/**
 * Revisa el cuerpo de POST /api/auth/ingreso.
 * No dice si el correo tiene buen formato o si la contraseña es débil:
 * cualquier combinación que no sea texto se rechaza con el mismo mensaje.
 */
export function validarIngreso(req, _res, next) {
  const cuerpo = req.body ?? {}
  if (!esTexto(cuerpo.correoInstitucional) || !esTexto(cuerpo.clave) || !cuerpo.correoInstitucional.trim() || !cuerpo.clave) {
    throw new HttpError(400, 'Escribe tu correo institucional y tu contraseña')
  }
  req.body = {
    correoInstitucional: cuerpo.correoInstitucional.trim().toLowerCase(),
    clave: cuerpo.clave,
  }
  next()
}

/**
 * Revisa el cuerpo de PATCH /api/auth/yo. Solo deja pasar los campos que cada
 * rol puede cambiar de su propia cuenta; el correo, el rol y la contraseña no entran.
 */
export function validarEdicionCuenta(req, _res, next) {
  const cuerpo = req.body ?? {}
  const esEstudiante = req.usuario.tipo === RolUsuario.ESTUDIANTE
  const errores = []
  const cambios = {}

  if (cuerpo.nombre !== undefined) {
    const nombre = esTexto(cuerpo.nombre) ? cuerpo.nombre.trim().replace(/\s+/g, ' ') : ''
    if (nombre.replace(/\s/g, '').length < 3 || nombre.length > 80) {
      errores.push('Escribe tu nombre completo (entre 3 y 80 caracteres)')
    }
    cambios.nombre = nombre
  }

  if (esEstudiante && cuerpo.semestre !== undefined) {
    if (!Number.isInteger(cuerpo.semestre) || cuerpo.semestre < 1 || cuerpo.semestre > INSTITUCION.semestreMaximo) {
      errores.push(`El semestre debe ser un número entero entre 1 y ${INSTITUCION.semestreMaximo}`)
    }
    cambios.semestre = cuerpo.semestre
  }

  if (esEstudiante && cuerpo.sede !== undefined) {
    if (!INSTITUCION.sedes.includes(cuerpo.sede)) errores.push(`Selecciona una sede: ${INSTITUCION.sedes.join(', ')}`)
    cambios.sede = cuerpo.sede
  }

  if (esEstudiante && cuerpo.programa !== undefined) {
    if (!esTexto(cuerpo.programa) || !mongoose.isValidObjectId(cuerpo.programa)) {
      errores.push('Selecciona un programa académico')
    }
    cambios.programa = cuerpo.programa
  }

  if (!esEstudiante && cuerpo.dependencia !== undefined) {
    const dependencia = esTexto(cuerpo.dependencia) ? cuerpo.dependencia.trim() : ''
    if (dependencia.length < 3 || dependencia.length > 160) {
      errores.push('La dependencia debe tener entre 3 y 160 caracteres')
    }
    cambios.dependencia = dependencia
  }

  if (errores.length === 0 && Object.keys(cambios).length === 0) {
    errores.push('Envía al menos un dato de tu cuenta para cambiar')
  }
  if (errores.length > 0) throw new HttpError(400, 'Los datos de la cuenta no son válidos', errores)

  req.body = cambios
  next()
}
