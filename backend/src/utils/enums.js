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
