import bcrypt from 'bcryptjs'
import { Administrador, Estudiante, Materia, PerfilTutor, Programa, Sesion, Usuario } from '../models/index.js'
import { ADMINISTRADOR, ESTUDIANTES, MATERIAS, PERFILES_TUTOR, PROGRAMAS, SESIONES } from '../scripts/datosSemilla.js'

/** Vueltas de bcrypt: cada unidad duplica el trabajo necesario para probar una contraseña. */
const COSTO_HASH = 10

/**
 * Indica si una contraseña cumple el mínimo: 8 caracteres, con letras y números.
 * @param {string} clave
 * @returns {boolean}
 */
export function esClaveAceptable(clave) {
  return typeof clave === 'string' && clave.length >= 8 && /[a-zA-Z]/.test(clave) && /\d/.test(clave)
}

/**
 * Crea el documento si no existe o lo actualiza si ya está, buscándolo por su
 * clave natural (correo, código...). Por eso el seed se puede repetir sin duplicar.
 * Usa save() para que se apliquen todas las validaciones del esquema.
 */
async function guardar(Modelo, filtro, datos) {
  const documento = (await Modelo.findOne(filtro)) ?? new Modelo()
  documento.set(datos)
  await documento.save()
  return documento
}

/**
 * Carga los datos de demostración: programas y materias reales de Uniguajira,
 * cuentas ficticias, perfiles de tutor y una sesión en cada estado.
 * @param {string} claveDemo Contraseña de las cuentas de demostración (variable CLAVE_DEMO).
 * @returns {Promise<{programas: number, materias: number, usuarios: number, perfilesTutor: number, sesiones: number}>}
 *   Cantidad de documentos que hay en cada colección al terminar.
 */
export async function cargarSemilla(claveDemo) {
  if (!esClaveAceptable(claveDemo)) {
    throw new Error('CLAVE_DEMO debe tener al menos 8 caracteres, con letras y números (revisa backend/.env).')
  }
  const claveHash = await bcrypt.hash(claveDemo, COSTO_HASH)
  const consentimientoDatos = { aceptado: true, fecha: new Date('2026-11-01T00:00:00.000Z') }

  // 1. Programas
  const programas = new Map()
  for (const datos of PROGRAMAS) {
    programas.set(datos.nombre, await guardar(Programa, { nombre: datos.nombre }, datos))
  }

  // 2. Materias
  const materias = new Map()
  for (const datos of MATERIAS) {
    const materia = await guardar(Materia, { codigo: datos.codigo }, {
      ...datos,
      programa: programas.get(datos.programa)._id,
      activa: true,
    })
    materias.set(datos.codigo, materia)
  }

  // 3. Usuarios
  const usuarios = new Map()
  for (const datos of ESTUDIANTES) {
    const estudiante = await guardar(Estudiante, { correoInstitucional: datos.correoInstitucional }, {
      ...datos,
      programa: programas.get(datos.programa)._id,
      claveHash,
      consentimientoDatos,
    })
    usuarios.set(datos.correoInstitucional, estudiante)
  }
  await guardar(Administrador, { correoInstitucional: ADMINISTRADOR.correoInstitucional }, {
    ...ADMINISTRADOR,
    claveHash,
    consentimientoDatos,
  })

  // 4. Perfiles de tutor: cada uno ofrece las materias de su programa
  const perfiles = new Map()
  for (const datos of PERFILES_TUTOR) {
    const estudiante = usuarios.get(datos.estudiante)
    const materiasDelPrograma = [...materias.values()]
      .filter((materia) => materia.programa.equals(estudiante.programa))
      .map((materia) => materia._id)
    const perfil = await guardar(PerfilTutor, { estudiante: estudiante._id }, {
      ...datos,
      estudiante: estudiante._id,
      materias: materiasDelPrograma,
      motivoRechazo: null,
    })
    perfiles.set(datos.estudiante, perfil)
  }

  // 5. Sesiones: toman la primera franja del tutor
  for (const datos of SESIONES) {
    const perfil = perfiles.get(datos.tutor)
    const { dia, horaInicio, horaFin } = perfil.disponibilidad[0]
    const fecha = new Date(`${datos.fecha}T00:00:00.000Z`)
    const filtro = {
      solicitante: usuarios.get(datos.solicitante)._id,
      tutor: perfil._id,
      fecha,
      'franja.horaInicio': horaInicio,
    }
    await guardar(Sesion, filtro, {
      solicitante: filtro.solicitante,
      tutor: perfil._id,
      materia: materias.get(datos.materia)._id,
      fecha,
      franja: { dia, horaInicio, horaFin },
      tema: datos.tema,
      estado: datos.estado,
      motivo: datos.motivo ?? null,
      calificacion: datos.calificacion ?? null,
    })
  }

  return contarDocumentos()
}

/** Cuenta los documentos de cada colección. */
export async function contarDocumentos() {
  const [programas, materias, usuarios, perfilesTutor, sesiones] = await Promise.all([
    Programa.countDocuments(),
    Materia.countDocuments(),
    Usuario.countDocuments(),
    PerfilTutor.countDocuments(),
    Sesion.countDocuments(),
  ])
  return { programas, materias, usuarios, perfilesTutor, sesiones }
}
