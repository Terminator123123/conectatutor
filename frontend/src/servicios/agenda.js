import { DiaSemana } from '../modelo/enums.js'

// Colombia no tiene horario de verano; el desfase permanece en UTC−05:00.
export const ZONA_HORARIA = 'America/Bogota'
export const DESFASE_HORARIO = '-05:00'
export const ETIQUETAS_DIA = Object.freeze({
  [DiaSemana.LUNES]: 'Lunes',
  [DiaSemana.MARTES]: 'Martes',
  [DiaSemana.MIERCOLES]: 'Miércoles',
  [DiaSemana.JUEVES]: 'Jueves',
  [DiaSemana.VIERNES]: 'Viernes',
  [DiaSemana.SABADO]: 'Sábado',
})

/** @param {import('../modelo/FranjaHoraria.js').default} franja Franja del tutor.
 * @returns {string} Día y horas legibles. */
export function formatearFranja(franja) {
  return `${ETIQUETAS_DIA[franja.getDia()]} · ${franja.getHoraInicio()}–${franja.getHoraFin()}`
}

/** @param {Date} fecha Fecha que se presenta.
 * @returns {string} Fecha larga en español y zona colombiana. */
export function formatearFecha(fecha) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA_HORARIA,
  }).format(fecha)
}

/** @param {Date} fecha Fecha que se convierte.
 * @returns {string} Día colombiano en formato AAAA-MM-DD. */
export function fechaEnColombia(fecha) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(fecha)
}

/**
 * Encuentra coincidencias desde mañana hasta el límite de días en Colombia.
 * @param {import('../modelo/FranjaHoraria.js').default} franja Franja buscada.
 * @param {Date} [desde=new Date()] Fecha de referencia.
 * @param {number} [dias=14] Cantidad de días futuros que se consultan.
 * @returns {{fecha: Date, clave: string}[]} Fechas y claves del día colombiano.
 */
export function proximasOcurrencias(franja, desde = new Date(), dias = 14) {
  const diaBase = new Date(`${fechaEnColombia(desde)}T12:00:00${DESFASE_HORARIO}`)
  const diasSemana = [null, ...Object.keys(ETIQUETAS_DIA)]
  const ocurrencias = []
  for (let desplazamiento = 1; desplazamiento <= dias; desplazamiento += 1) {
    const dia = new Date(diaBase.getTime() + desplazamiento * 86400000)
    if (diasSemana[dia.getUTCDay()] === franja.getDia()) {
      const clave = fechaEnColombia(dia)
      ocurrencias.push({ clave, fecha: new Date(`${clave}T${franja.getHoraInicio()}:00${DESFASE_HORARIO}`) })
    }
  }
  return ocurrencias
}
