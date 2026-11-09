// Presenta las fechas con el formato breve y la zona horaria del prototipo.

/** @param {Date} fecha Fecha real de la sesión.
 * @param {boolean} [incluirAno=true] Incluye el año fuera de las etiquetas de disponibilidad.
 * @param {boolean} [incluirDia=true] Incluye el nombre abreviado del día.
 * @returns {string} Día, fecha y mes abreviados en español. */
export function formatearFechaBreve(fecha, incluirAno = true, incluirDia = true) {
  const partes = new Intl.DateTimeFormat('es-CO', { weekday:'short', day:'numeric', month:'short', year:'numeric', timeZone:'America/Bogota' }).formatToParts(fecha)
  const parte = (tipo) => partes.find((item) => item.type === tipo).value.replace(/\.$/, '')
  const dia = parte('weekday').replace(/^./, (letra) => letra.toLocaleUpperCase('es'))
  return `${incluirDia ? dia + ' ' : ''}${parte('day')} ${parte('month').replace(/^sept$/, 'sep')}${incluirAno ? ' ' + parte('year') : ''}`
}
