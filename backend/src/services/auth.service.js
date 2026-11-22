import { randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { aSegundos, env } from '../config/env.js'
import { Estudiante, PerfilTutor, Programa, Usuario } from '../models/index.js'
import { cifrarClave, compararClave } from '../utils/claves.js'
import { RolUsuario } from '../utils/enums.js'
import { HttpError } from '../utils/HttpError.js'

/** Prefijo de `sesionActiva` cuando la persona salió: ningún token de esa sesión vuelve a servir. */
export const PREFIJO_SESION_CERRADA = 'cerrada:'

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
 * Crea el token de sesión de un usuario (RQNF005).
 * Solo lleva el id, el rol y cuándo empezó la sesión (`ini`): nada privado,
 * porque el contenido de un JWT se puede leer.
 * Vence tras `sesionInactividad` sin uso; cada petición autenticada lo renueva
 * (ver middlewares/autenticar.js) hasta el tope absoluto `jwtDuracion`.
 * @param {{id: string, tipo: string}} usuario
 * @param {number} [inicio] Segundos desde 1970 en que se inició la sesión; por defecto, ahora.
 * @returns {string}
 */
export function firmarToken(usuario, inicio = Math.floor(Date.now() / 1000), sesion = undefined) {
  const tope = inicio + aSegundos(env.jwtDuracion)
  const ahora = Math.floor(Date.now() / 1000)
  return jwt.sign({ rol: usuario.tipo, ini: inicio, ...(sesion ? { sid: sesion } : {}) }, env.jwtSecreto, {
    subject: String(usuario.id),
    expiresIn: Math.max(0, Math.min(aSegundos(env.sesionInactividad), tope - ahora)),
    algorithm: ALGORITMO_TOKEN,
  })
}

/**
 * Abre la única sesión activa de la cuenta: un ingreso nuevo invalida los tokens de
 * cualquier otro navegador o dispositivo (ver middlewares/autenticar.js).
 * Con `claveHash`, la sesión solo se abre si la contraseña sigue siendo la que se
 * comparó: si se cambió o se recuperó entre la comparación y este paso, responde 401.
 * @param {import('mongoose').Document} usuario
 * @param {string} [claveHash] Hash de la contraseña con que se validó el ingreso.
 * @returns {Promise<string>} Token de la sesión nueva.
 */
export async function abrirSesionUnica(usuario, claveHash) {
  const sesion = randomBytes(16).toString('hex')
  const filtro = claveHash === undefined ? { _id: usuario._id } : { _id: usuario._id, claveHash }
  const { matchedCount } = await Usuario.updateOne(filtro, { $set: { sesionActiva: sesion } })
  if (matchedCount !== 1) throw new HttpError(401, MENSAJE_CREDENCIALES)
  return firmarToken(usuario, undefined, sesion)
}

/**
 * Cierra en el servidor la sesión del token (RQF003): desde ese momento ningún token
 * de esa sesión sirve, aunque alguien conserve una copia. Solo la cierra si sigue
 * siendo la activa: un cierre atrasado no invalida un ingreso posterior.
 * @param {import('mongoose').Document} usuario
 * @param {string|null} sesion `sid` del token con que se pide salir.
 */
export async function cerrarSesionUnica(usuario, sesion) {
  await Usuario.updateOne(
    { _id: usuario._id, sesionActiva: sesion ?? null },
    { $set: { sesionActiva: `${PREFIJO_SESION_CERRADA}${randomBytes(16).toString('hex')}` } },
  )
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

  return { token: await abrirSesionUnica(estudiante), usuario: await presentarUsuario(estudiante) }
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
  return { token: await abrirSesionUnica(usuario, usuario.claveHash), usuario: await presentarUsuario(usuario) }
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
