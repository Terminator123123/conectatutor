import { INSTITUCION } from '../config/institucion.js'
import { franjasSeSolapan } from '../models/franja.schema.js'
import { DiaSemana } from '../utils/enums.js'
import { HttpError } from '../utils/HttpError.js'
import { esIdValido } from './validarId.js'

const FORMATO_HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const TARIFA_MAXIMA = 500000
const MATERIAS_MAXIMAS = 40
const FRANJAS_MAXIMAS = 30
const DIAS = Object.values(DiaSemana)

/**
 * Revisa el cuerpo de PUT /api/tutores/mi-perfil y lo deja limpio en req.body.
 * El estado de verificación NO se acepta aquí: solo lo cambia el administrador.
 */
export function validarPerfilTutor(req, _res, next) {
  const cuerpo = req.body ?? {}
  const errores = []

  const biografia = typeof cuerpo.biografia === 'string' ? cuerpo.biografia.trim() : ''
  if (biografia.length < 20 || biografia.length > 500) {
    errores.push('La biografía debe tener entre 20 y 500 caracteres')
  }

  // R10: null (o ausente) = gratuita; si se cobra, un número mayor que cero.
  const tarifaHora = cuerpo.tarifaHora ?? null
  if (tarifaHora !== null && (typeof tarifaHora !== 'number' || !Number.isFinite(tarifaHora) || tarifaHora <= 0 || tarifaHora > TARIFA_MAXIMA)) {
    errores.push(`La tarifa debe ser un número mayor que cero y hasta ${TARIFA_MAXIMA}; envía null si la tutoría es gratuita`)
  }

  const materias = cuerpo.materias ?? []
  if (!Array.isArray(materias) || materias.length > MATERIAS_MAXIMAS || !materias.every(esIdValido)) {
    errores.push('materias debe ser una lista de identificadores de materias')
  } else if (new Set(materias).size !== materias.length) {
    errores.push('Una materia no puede repetirse en el perfil')
  }

  const disponibilidad = []
  const franjas = cuerpo.disponibilidad ?? []
  if (!Array.isArray(franjas) || franjas.length > FRANJAS_MAXIMAS) {
    errores.push('disponibilidad debe ser una lista de franjas')
  } else {
    for (const franja of franjas) {
      const { dia, horaInicio, horaFin } = franja ?? {}
      // Se exige texto antes de aplicar la expresión regular: una lista como ['08:00'] la
      // pasaría al convertirse sola en texto, y un objeto la haría fallar con un error interno.
      const sonTexto = [dia, horaInicio, horaFin].every((valor) => typeof valor === 'string')
      if (!sonTexto || !DIAS.includes(dia) || !FORMATO_HORA.test(horaInicio) || !FORMATO_HORA.test(horaFin)) {
        errores.push('Cada franja necesita un día válido y horas con el formato HH:MM')
        break
      }
      if (horaInicio >= horaFin) {
        errores.push(`En la franja del ${dia} la hora de inicio debe ser anterior a la hora de fin`)
        break
      }
      // R9: sin solapamientos dentro de la disponibilidad.
      if (disponibilidad.some((otra) => franjasSeSolapan(otra, { dia, horaInicio, horaFin }))) {
        errores.push(`La franja ${dia} ${horaInicio} - ${horaFin} se solapa con otra de tu disponibilidad`)
        break
      }
      disponibilidad.push({ dia, horaInicio, horaFin })
    }
  }

  if (errores.length > 0) throw new HttpError(400, 'Los datos del perfil no son válidos', errores)

  req.body = { biografia, tarifaHora, materias, disponibilidad }
  next()
}

/**
 * Revisa los filtros de GET /api/tutores y los deja con su tipo en req.filtros.
 * Un filtro vacío se ignora; uno mal escrito se rechaza con 400.
 */
export function validarBusquedaTutores(req, _res, next) {
  const consulta = req.query
  const errores = []
  const filtros = {}
  const texto = (nombre) => (typeof consulta[nombre] === 'string' && consulta[nombre] !== '' ? consulta[nombre] : undefined)

  for (const nombre of ['materia', 'programa']) {
    const valor = texto(nombre)
    if (valor === undefined) continue
    if (esIdValido(valor)) filtros[nombre] = valor
    else errores.push(`El filtro ${nombre} no es un identificador válido`)
  }

  const sede = texto('sede')
  if (sede !== undefined) {
    if (INSTITUCION.sedes.includes(sede)) filtros.sede = sede
    else errores.push(`El filtro sede debe ser una de: ${INSTITUCION.sedes.join(', ')}`)
  }

  const dia = texto('dia')
  if (dia !== undefined) {
    if (DIAS.includes(dia.toUpperCase())) filtros.dia = dia.toUpperCase()
    else errores.push(`El filtro dia debe ser uno de: ${DIAS.join(', ')}`)
  }

  const precioMaximo = texto('precioMaximo')
  if (precioMaximo !== undefined) {
    const numero = Number(precioMaximo)
    if (Number.isFinite(numero) && numero >= 0) filtros.precioMaximo = numero
    else errores.push('El filtro precioMaximo debe ser un número mayor o igual a cero')
  }

  const calificacionMinima = texto('calificacionMinima')
  if (calificacionMinima !== undefined) {
    const numero = Number(calificacionMinima)
    if (Number.isFinite(numero) && numero >= 1 && numero <= 5) filtros.calificacionMinima = numero
    else errores.push('El filtro calificacionMinima debe ser un número entre 1 y 5')
  }

  const soloGratuitas = texto('soloGratuitas')
  if (soloGratuitas !== undefined) {
    if (soloGratuitas === 'true' || soloGratuitas === 'false') filtros.soloGratuitas = soloGratuitas === 'true'
    else errores.push('El filtro soloGratuitas debe ser true o false')
  }

  // Un mismo filtro repetido (?dia=LUNES&dia=MARTES) llega como lista: no se admite.
  for (const [nombre, valor] of Object.entries(consulta)) {
    if (typeof valor !== 'string') errores.push(`El filtro ${nombre} debe enviarse una sola vez`)
  }

  if (errores.length > 0) throw new HttpError(400, 'Los filtros de búsqueda no son válidos', errores)

  req.filtros = filtros
  next()
}
