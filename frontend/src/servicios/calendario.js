// Enlace para añadir una sesión confirmada a Google Calendar, sin integraciones ni permisos.

/**
 * Construye el enlace de "crear evento" de Google Calendar con la hora de Bogotá.
 * @param {object} datos Datos visibles de la sesión.
 * @param {Date} datos.fecha Día de la sesión.
 * @param {string} datos.horaInicio Hora de inicio en formato HH:MM.
 * @param {string} datos.horaFin Hora de fin en formato HH:MM.
 * @param {string} datos.materia Nombre de la materia.
 * @param {string} datos.persona Nombre de la otra persona de la sesión.
 * @param {string} [datos.tema] Tema que se trabajará.
 * @returns {string} URL de Google Calendar.
 */
export function enlaceGoogleCalendar({ fecha, horaInicio, horaFin, materia, persona, tema = '' }) {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(fecha).replaceAll('-', '')
  const hora = (texto) => texto.replace(':', '').padStart(4, '0') + '00'
  const parametros = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Tutoría de ${materia} con ${persona}`,
    dates: `${dia}T${hora(horaInicio)}/${dia}T${hora(horaFin)}`,
    ctz: 'America/Bogota',
    details: tema ? `Tema: ${tema}\nConectaTutor Uniguajira` : 'ConectaTutor Uniguajira',
  })
  return `https://calendar.google.com/calendar/render?${parametros}`
}
