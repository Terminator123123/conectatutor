import { randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Estudiante, PerfilTutor, Programa, Usuario } from '../models/index.js'
import { cifrarClave, compararClave } from '../utils/claves.js'
import { RolUsuario } from '../utils/enums.js'
import { HttpError } from '../utils/HttpError.js'

/** Algoritmo de firma de los tokens. Se fija para que no se acepte ningún otro. */
export const ALGORITMO_TOKEN = 'HS256'

const MENSAJE_CREDENCIALES = 'El correo o la contraseña no son correctos'

/**
 * Hash de una contraseña al azar. Cuando el correo no existe se compara contra él,
 * para que la respuesta tarde lo mismo que con un correo que sí existe y no se
 * pueda deducir por el tiempo qué correos están registrados.
 */
const hashSenuelo = cifrarClave(randomBytes(24).toString('hex'))

/**
 * Crea el token de sesión de un usuario.
 * Solo lleva el id y el rol: nada que sea privado, porque el contenido de un JWT se puede leer.
 * @param {{id: string, tipo: string}} usuario
 * @returns {string}
 */
export function firmarToken(usuario) {
  return jwt.sign({ rol: usuario.tipo }, env.jwtSecreto, {
    subject: String(usuario.id),
    expiresIn: env.jwtDuracion,
    algorithm: ALGORITMO_TOKEN,
  })
}

/**
 * Arma los datos del usuario que se devuelven al cliente: sin contraseña,
 * con el programa completo y con el resumen de su perfil de tutor si lo tiene.
 * @param {import('mongoose').Document} usuario
 */
export async function presentarUsuario(usuario) {
  let perfilTutor = null
  if (usuario.tipo === RolUsuario.ESTUDIANTE) {
    await usuario.populate('programa')
    const perfil = await PerfilTutor.findOne({ estudiante: usuario._id }).select('estadoVerificacion')
    if (perfil) perfilTutor = { id: perfil.id, estadoVerificacion: perfil.estadoVerificacion }
  }
  return { ...usuario.toJSON(), perfilTutor }
}

/**
 * Registra a un estudiante (RQF001, RQF002, RQF004, RQF005, RQNF009).
 * Los datos ya llegan revisados por el middleware validarRegistro.
 * @returns {Promise<{token: string, usuario: object}>}
 */
export async function registrar({ nombre, correoInstitucional, clave, semestre, sede, programa, quiereSerTutor }) {
  if (!(await Programa.exists({ _id: programa }))) {
    throw new HttpError(400, 'Los datos de registro no son válidos', ['El programa seleccionado no existe'])
  }
  if (await Usuario.exists({ correoInstitucional })) {
    throw new HttpError(409, 'Ya existe una cuenta registrada con este correo institucional')
  }

  let estudiante
  try {
    estudiante = await Estudiante.create({
      nombre,
      correoInstitucional,
      claveHash: await cifrarClave(clave),
      semestre,
      sede,
      programa,
      quiereSerTutor,
      consentimientoDatos: { aceptado: true, fecha: new Date() },
    })
  } catch (error) {
    // Dos registros con el mismo correo al mismo tiempo: el índice único deja pasar solo uno.
    if (error?.code === 11000) {
      throw new HttpError(409, 'Ya existe una cuenta registrada con este correo institucional')
    }
    throw error
  }

  return { token: firmarToken(estudiante), usuario: await presentarUsuario(estudiante) }
}

/**
 * Inicia sesión (RQF003). Responde igual si el correo no existe o si la
 * contraseña es incorrecta, para no revelar qué correos están registrados.
 * @returns {Promise<{token: string, usuario: object}>}
 */
export async function ingresar({ correoInstitucional, clave }) {
  const usuario = await Usuario.findOne({ correoInstitucional }).select('+claveHash')
  const coincide = await compararClave(clave, usuario?.claveHash ?? (await hashSenuelo))
  if (!usuario || !coincide) {
    throw new HttpError(401, MENSAJE_CREDENCIALES)
  }
  return { token: firmarToken(usuario), usuario: await presentarUsuario(usuario) }
}

/**
 * Cambia los datos de la cuenta propia (RQF026). El correo y el rol no se pueden cambiar.
 * Los datos ya llegan revisados por el middleware validarEdicionCuenta.
 * @param {import('mongoose').Document} usuario Usuario con la sesión iniciada.
 * @param {object} cambios Solo los campos que se quieren cambiar.
 */
export async function editarCuenta(usuario, cambios) {
  if (cambios.programa !== undefined && !(await Programa.exists({ _id: cambios.programa }))) {
    throw new HttpError(400, 'Los datos de la cuenta no son válidos', ['El programa seleccionado no existe'])
  }
  usuario.set(cambios)
  await usuario.save()
  return presentarUsuario(usuario)
}
