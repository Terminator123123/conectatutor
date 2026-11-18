// Presentación de las notificaciones de la campana.

/** "hace 5 min", "hace 2 h", "hace 3 días". */
export function haceCuanto(fecha, ahora = Date.now()) {
  const minutos = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 60000))
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export const ICONOS_NOTIFICACION = {
  SOLICITUD_NUEVA: 'bi-envelope-plus', SOLICITUD_ACEPTADA: 'bi-check-circle', SOLICITUD_RECHAZADA: 'bi-x-circle',
  SESION_CANCELADA: 'bi-calendar-x', SESION_FINALIZADA: 'bi-star', SESION_TERMINADA: 'bi-flag',
  CALIFICACION_RECIBIDA: 'bi-star-fill', REPROGRAMACION_PROPUESTA: 'bi-calendar2-week', REPROGRAMACION_RESPONDIDA: 'bi-calendar-check',
  RECORDATORIO: 'bi-alarm',
}
