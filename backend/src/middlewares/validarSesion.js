import { DiaSemana, EstadoSesion, MotivoCancelacion } from '../utils/enums.js'
import { esDiaValido } from '../utils/fechas.js'
import { HttpError } from '../utils/HttpError.js'
import { esIdValido } from './validarId.js'

const FORMATO_HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const DIAS = Object.values(DiaSemana)
const esTexto = (valor) => typeof valor === 'string'

/** Revisa una franja y la devuelve limpia, o agrega el error a la lista. */
function leerFranja(franja, errores) {
  const { dia, horaInicio, horaFin } = franja ?? {}
  // Se exige texto: una lista como ['08:00'] pasaría la expresión regular al convertirse sola en texto.
  const sonTexto = esTexto(horaInicio) && esTexto(horaFin)
  if (!DIAS.includes(dia) || !sonTexto || !FORMATO_HORA.test(horaInicio) || !FORMATO_HORA.test(horaFin) || horaInicio >= horaFin) {
    errores.push('La franja necesita un día válido y horas con el formato HH:MM, con el inicio antes del fin')
    return null
  }
  return { dia, horaInicio, horaFin }
}

/** Revisa un día calendario "AAAA-MM-DD" o agrega el error a la lista. */
function leerDia(fecha, errores) {
  if (!esDiaValido(fecha)) {
    errores.push('La fecha debe ser un día real con el formato AAAA-MM-DD')
    return null
  }
  return fecha
}

/** Revisa un motivo: obligatorio de 5 a 300 caracteres, u opcional si así se indica. */
function leerMotivo(motivo, errores, { obligatorio }) {
  const texto = esTexto(motivo) ? motivo.trim() : ''
  if ((obligatorio || texto.length > 0) && (texto.length < 5 || texto.length > 300)) {
    errores.push('Escribe el motivo (entre 5 y 300 caracteres)')
  }
  return texto
}

/** Valida el cuerpo de POST /api/sesiones. */
export function validarSolicitud(req, _res, next) {
  const cuerpo = req.body ?? {}
  const errores = []

  if (!esIdValido(cuerpo.tutor)) errores.push('Selecciona el tutor')
  if (!esIdValido(cuerpo.materia)) errores.push('Selecciona la materia')
  const fecha = leerDia(cuerpo.fecha, errores)
  const franja = leerFranja(cuerpo.franja, errores)

  // RQF013: el tema le dice al tutor qué preparar; por eso se pide con algo de detalle.
  const tema = esTexto(cuerpo.tema) ? cuerpo.tema.trim().replace(/\s+/g, ' ') : ''
  if (tema.length < 10 || tema.length > 300 || tema.split(' ').length < 3) {
    errores.push('Describe el tema de la tutoría con al menos 3 palabras (entre 10 y 300 caracteres)')
  }

  if (errores.length > 0) throw new HttpError(400, 'Los datos de la solicitud no son válidos', errores)
  req.body = { tutor: cuerpo.tutor, materia: cuerpo.materia, fecha, franja, tema }
  next()
}

/** Valida el cuerpo de las acciones que exigen un motivo (rechazar y cancelar). */
export function validarMotivo(req, _res, next) {
  const errores = []
  const motivo = leerMotivo(req.body?.motivo, errores, { obligatorio: true })
  if (errores.length > 0) throw new HttpError(400, 'Falta el motivo', errores)
  req.body = { motivo }
  next()
}

/** Valida el cuerpo de POST /api/sesiones/:id/calificacion (R7). */
export function validarCalificacion(req, _res, next) {
  const cuerpo = req.body ?? {}
  const errores = []
  if (!Number.isInteger(cuerpo.puntaje) || cuerpo.puntaje < 1 || cuerpo.puntaje > 5) {
    errores.push('El puntaje debe ser un número entero de 1 a 5')
  }
  const resena = cuerpo.resena === undefined || cuerpo.resena === null ? '' : cuerpo.resena
  if (!esTexto(resena) || resena.trim().length > 500) {
    errores.push('La reseña es un texto de hasta 500 caracteres')
  }
  if (errores.length > 0) throw new HttpError(400, 'La calificación no es válida', errores, 'R7')
  req.body = { puntaje: cuerpo.puntaje, resena: resena.trim() }
  next()
}

/** Valida el cuerpo de PUT /api/sesiones/:id/reprogramacion (la propuesta). */
export function validarPropuesta(req, _res, next) {
  const cuerpo = req.body ?? {}
  const errores = []
  const fecha = leerDia(cuerpo.fecha, errores)
  const franja = leerFranja(cuerpo.franja, errores)
  const motivo = leerMotivo(cuerpo.motivo, errores, { obligatorio: false })
  if (errores.length > 0) throw new HttpError(400, 'La propuesta de reprogramación no es válida', errores)
  req.body = { fecha, franja, motivo }
  next()
}

/** Valida el cuerpo de PATCH /api/sesiones/:id/reprogramacion (la respuesta). */
export function validarRespuesta(req, _res, next) {
  if (typeof req.body?.acepta !== 'boolean') {
    throw new HttpError(400, 'Indica si aceptas la propuesta', ['acepta debe ser verdadero o falso'])
  }
  req.body = { acepta: req.body.acepta }
  next()
}

/** Valida los filtros de GET /api/sesiones y los deja en req.filtros. */
export function validarFiltrosSesiones(req, _res, next) {
  const { estado, papel } = req.query
  const errores = []
  const filtros = {}
  if (estado !== undefined && estado !== '') {
    if (esTexto(estado) && Object.values(EstadoSesion).includes(estado.toUpperCase())) filtros.estado = estado.toUpperCase()
    else errores.push(`El filtro estado debe ser uno de: ${Object.values(EstadoSesion).join(', ')}`)
  }
  if (papel !== undefined && papel !== '') {
    if (esTexto(papel) && ['SOLICITANTE', 'TUTOR'].includes(papel.toUpperCase())) filtros.papel = papel.toUpperCase()
    else errores.push('El filtro papel debe ser SOLICITANTE o TUTOR')
  }
  if (errores.length > 0) throw new HttpError(400, 'Los filtros no son válidos', errores)
  req.filtros = filtros
  next()
}

/**
 * Valida la encuesta de PATCH /api/sesiones/:id/cancelar (RQF016): una o varias razones
 * de MotivoCancelacion y, si se marca OTRO, una explicación de al menos 5 caracteres.
 * Por compatibilidad acepta también solo `motivo` (texto), que se cuenta como OTRO.
 */
export function validarCancelacion(req, _res, next) {
  const cuerpo = req.body ?? {}
  const errores = []
  let motivos = cuerpo.motivos
  if (motivos === undefined && typeof cuerpo.motivo === 'string') motivos = ['OTRO']
  if (!Array.isArray(motivos) || motivos.length === 0) {
    errores.push('Marca al menos una razón de la cancelación')
    motivos = []
  }
  const validos = Object.keys(MotivoCancelacion)
  if (motivos.some((motivo) => !validos.includes(motivo))) errores.push(`Las razones deben ser: ${validos.join(', ')}`)
  const unicos = [...new Set(motivos)]
  const conOtro = unicos.includes('OTRO')
  const texto = leerMotivo(cuerpo.motivo, errores, { obligatorio: conOtro })
  if (errores.length > 0) throw new HttpError(400, 'La encuesta de cancelación no es válida', errores)
  const etiquetas = unicos.filter((motivo) => motivo !== 'OTRO').map((motivo) => MotivoCancelacion[motivo])
  if (conOtro && texto) etiquetas.push(texto)
  req.body = { motivos: unicos, motivo: etiquetas.join('. ').slice(0, 300) }
  next()
}
