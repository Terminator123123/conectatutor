import { DiaSemana } from './enums.js'

// Las tutorías ocurren en Colombia, que no tiene horario de verano: siempre UTC-05:00.
// El día de una sesión viaja como texto "AAAA-MM-DD" y se guarda a las 00:00 UTC de ese día,
// así el mismo día significa lo mismo sin importar dónde esté el servidor.

const DESFASE_COLOMBIA = '-05:00'
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/
const DIAS_EN_ORDEN = [
  DiaSemana.DOMINGO, DiaSemana.LUNES, DiaSemana.MARTES, DiaSemana.MIERCOLES,
  DiaSemana.JUEVES, DiaSemana.VIERNES, DiaSemana.SABADO,
]

/**
 * Indica si un texto es un día calendario real con el formato AAAA-MM-DD.
 * @param {unknown} texto
 * @returns {boolean}
 */
export function esDiaValido(texto) {
  if (typeof texto !== 'string' || !FORMATO_DIA.test(texto)) return false
  const fecha = new Date(`${texto}T00:00:00.000Z`)
  // "2026-02-31" se convierte en marzo: se descarta comparando de vuelta.
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto
}

/** "2026-11-23" -> Date a las 00:00 UTC de ese día (como se guarda en la base). */
export function aFechaGuardada(dia) {
  return new Date(`${dia}T00:00:00.000Z`)
}

/** Date guardada -> "2026-11-23". */
export function aTextoDia(fecha) {
  return fecha.toISOString().slice(0, 10)
}

/** Día de la semana (valor de DiaSemana) de un día "AAAA-MM-DD". */
export function diaDeLaSemana(dia) {
  return DIAS_EN_ORDEN[aFechaGuardada(dia).getUTCDay()]
}

/** Momento exacto en que empieza una tutoría: el día y la hora, en hora de Colombia. */
export function momentoDeInicio(dia, horaInicio) {
  return new Date(`${dia}T${horaInicio}:00${DESFASE_COLOMBIA}`)
}

/** El día de hoy en Colombia, como "AAAA-MM-DD". */
export function hoyEnColombia(ahora = new Date()) {
  return new Date(ahora.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
