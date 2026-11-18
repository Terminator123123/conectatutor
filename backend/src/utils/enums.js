// Valores cerrados del dominio. Son los mismos del modelo del frontend (src/modelo/enums.js).

/** Tipos de usuario: es el discriminador de la colección `usuarios`. */
export const RolUsuario = Object.freeze({
  ESTUDIANTE: 'ESTUDIANTE',
  ADMINISTRADOR: 'ADMINISTRADOR',
})

/** Estados permitidos para una sesión de tutoría. */
export const EstadoSesion = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  CONFIRMADA: 'CONFIRMADA',
  RECHAZADA: 'RECHAZADA',
  CANCELADA: 'CANCELADA',
  FINALIZADA: 'FINALIZADA',
})

/** Estados en los que una sesión ocupa la franja del tutor. */
export const ESTADOS_QUE_OCUPAN_FRANJA = Object.freeze([
  EstadoSesion.PENDIENTE,
  EstadoSesion.CONFIRMADA,
])

/** Estados de la verificación de un perfil de tutor. */
export const EstadoVerificacion = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  VERIFICADO: 'VERIFICADO',
  RECHAZADO: 'RECHAZADO',
})

/** Días admitidos para las franjas de disponibilidad. */
export const DiaSemana = Object.freeze({
  LUNES: 'LUNES',
  MARTES: 'MARTES',
  MIERCOLES: 'MIERCOLES',
  JUEVES: 'JUEVES',
  VIERNES: 'VIERNES',
  SABADO: 'SABADO',
  DOMINGO: 'DOMINGO',
})

/** Tipos de notificación de la campana (RQF022). */
export const TipoNotificacion = Object.freeze({
  SOLICITUD_NUEVA: 'SOLICITUD_NUEVA',
  SOLICITUD_ACEPTADA: 'SOLICITUD_ACEPTADA',
  SOLICITUD_RECHAZADA: 'SOLICITUD_RECHAZADA',
  SESION_CANCELADA: 'SESION_CANCELADA',
  SESION_FINALIZADA: 'SESION_FINALIZADA',
  SESION_TERMINADA: 'SESION_TERMINADA',
  CALIFICACION_RECIBIDA: 'CALIFICACION_RECIBIDA',
  REPROGRAMACION_PROPUESTA: 'REPROGRAMACION_PROPUESTA',
  REPROGRAMACION_RESPONDIDA: 'REPROGRAMACION_RESPONDIDA',
  RECORDATORIO: 'RECORDATORIO',
})

/**
 * Razones de cancelación que se marcan en la encuesta (RQF016). Se guardan como clave
 * para poder contarlas en los reportes de Coordinación.
 */
export const MotivoCancelacion = Object.freeze({
  CRUCE_HORARIO: 'Tengo un cruce de horario',
  YA_RESOLVI: 'Ya resolví la duda',
  SALUD_PERSONAL: 'Motivos de salud o personales',
  TRANSPORTE_CONEXION: 'Problemas de transporte o de conexión',
  SIN_RESPUESTA: 'La otra persona no respondió',
  OTRO: 'Otro',
})
