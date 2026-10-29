/** Roles que responden las subclases de Usuario. */
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
})
