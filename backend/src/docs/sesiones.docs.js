import { INSTITUCION } from '../config/institucion.js'
import { EstadoSesion, EstadoVerificacion, MotivoCancelacion, TipoNotificacion } from '../utils/enums.js'

// Documentación OpenAPI de sesiones, favoritos y coordinación.

const ID_EJEMPLO = '6728f1a2b3c4d5e6f7a8b9c0'
const json = (esquema) => ({ 'application/json': { schema: esquema } })
const error = (descripcion) => ({ description: descripcion, content: json({ $ref: '#/components/schemas/Error' }) })
const conSesion = { security: [{ tokenJWT: [] }] }
const comunes = {
  401: { $ref: '#/components/responses/NoAutenticado' },
  500: { $ref: '#/components/responses/ErrorInterno' },
}
const privadas = { ...comunes, 403: { $ref: '#/components/responses/SinPermiso' } }
const idSesion = { name: 'id', in: 'path', required: true, description: 'Id de la sesión', schema: { type: 'string', example: ID_EJEMPLO } }
const idPerfil = { name: 'id', in: 'path', required: true, description: 'Id del perfil de tutor', schema: { type: 'string', example: ID_EJEMPLO } }
const sesionActualizada = (descripcion) => ({ description: descripcion, content: json({ $ref: '#/components/schemas/SesionDetallada' }) })
const cuerpoMotivo = { required: true, content: json({ $ref: '#/components/schemas/Motivo' }) }
const errorDeRegla = (descripcion) => error(`${descripcion}. El cuerpo incluye el campo regla`)
/** Conflicto en el que solo algunos casos corresponden a una regla identificada. */
const conflictoMixto = (conRegla, sinRegla) =>
  error(`${conRegla}: el cuerpo incluye el campo regla. ${sinRegla}: solo trae mensaje, sin regla`)

/** Acción del tutor o del solicitante que cambia el estado de una sesión. */
function cambioDeEstado({ resumen, descripcion, conMotivo = false }) {
  return {
    patch: {
      tags: ['Sesiones'],
      summary: resumen,
      description: descripcion,
      ...conSesion,
      parameters: [idSesion],
      ...(conMotivo ? { requestBody: cuerpoMotivo } : {}),
      responses: {
        200: sesionActualizada('Sesión actualizada'),
        400: error(conMotivo ? 'Falta el motivo o el id no es válido' : 'El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: errorDeRegla('R5: el estado actual de la sesión no permite la acción'),
        ...privadas,
      },
    },
  }
}

const persona = {
  type: 'object',
  properties: {
    id: { type: 'string', example: ID_EJEMPLO },
    nombre: { type: 'string', example: 'Elena Lozano' },
    sede: { type: 'string', enum: [...INSTITUCION.sedes] },
    semestre: { type: 'integer' },
    programa: { $ref: '#/components/schemas/Programa' },
    correoInstitucional: { type: 'string', description: 'Solo aparece para los participantes cuando la sesión está CONFIRMADA o FINALIZADA' },
  },
}

export const esquemasSesiones = {
  Motivo: {
    type: 'object',
    required: ['motivo'],
    properties: {
      motivo: {
        type: 'string',
        pattern: '^\\s*\\S[\\s\\S]{3,298}\\S\\s*$',
        description: 'Obligatorio: debe tener entre 5 y 300 caracteres después de quitar espacios al inicio y al final',
        example: 'Ese día tengo un parcial',
      },
    },
  },
  NuevaSesion: {
    type: 'object',
    required: ['tutor', 'materia', 'fecha', 'franja', 'tema'],
    properties: {
      tutor: { type: 'string', description: 'Id del perfil de tutor', example: ID_EJEMPLO },
      materia: { type: 'string', description: 'Id de una materia que el tutor ofrece', example: ID_EJEMPLO },
      fecha: { type: 'string', format: 'date', description: 'Día de la tutoría (AAAA-MM-DD). Debe caer en el día de la franja, ser futura y a máximo 60 días', example: '2026-11-23' },
      franja: { $ref: '#/components/schemas/Franja' },
      tema: { type: 'string', minLength: 10, maxLength: 300, description: 'Qué se va a trabajar; al menos 3 palabras', example: 'Repasar ciclos y arreglos para el parcial' },
    },
  },
  NuevaCalificacion: {
    type: 'object',
    required: ['puntaje'],
    properties: {
      puntaje: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
      resena: { type: 'string', maxLength: 500, example: 'Explicó con paciencia y ejemplos' },
    },
  },
  PropuestaReprogramacion: {
    type: 'object',
    required: ['fecha', 'franja'],
    properties: {
      fecha: { type: 'string', format: 'date', example: '2026-11-30' },
      franja: { $ref: '#/components/schemas/Franja' },
      motivo: {
        type: 'string',
        pattern: '^(?:\\s*|\\s*\\S[\\s\\S]{3,298}\\S\\s*)$',
        description: 'Opcional: puede omitirse o quedar vacío. El texto no vacío debe tener entre 5 y 300 caracteres después de quitar espacios al inicio y al final',
      },
    },
  },
  SesionDetallada: {
    type: 'object',
    description: 'Una sesión tal como la ve quien consulta',
    properties: {
      id: { type: 'string', example: ID_EJEMPLO },
      miPapel: { type: 'string', enum: ['SOLICITANTE', 'TUTOR', 'COORDINACION'] },
      solicitante: persona,
      tutor: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Id del perfil de tutor', example: ID_EJEMPLO },
          tarifaHora: { type: 'number', nullable: true, description: 'Tarifa por hora de esta reserva, la del tutor al solicitarla; null si es gratuita. No cambia si después el tutor edita su perfil' },
          estudiante: persona,
        },
      },
      materia: { type: 'object', properties: { id: { type: 'string' }, codigo: { type: 'string', example: 'SIS-04' }, nombre: { type: 'string' } } },
      fecha: { type: 'string', format: 'date', example: '2026-11-23' },
      franja: { $ref: '#/components/schemas/Franja' },
      tema: { type: 'string' },
      estado: { type: 'string', enum: Object.values(EstadoSesion) },
      motivo: { type: 'string', nullable: true, description: 'Motivo del rechazo o de la cancelación' },
      motivosCancelacion: { type: 'array', items: { type: 'string', enum: Object.keys(MotivoCancelacion) }, description: 'Razones marcadas en la encuesta al cancelar' },
      calificacion: { allOf: [{ $ref: '#/components/schemas/Calificacion' }], nullable: true },
      reprogramacion: {
        type: 'object',
        nullable: true,
        description: 'Propuesta de cambio de fecha que espera respuesta',
        properties: {
          propuestaPor: { type: 'string', description: 'Id del usuario que la propuso' },
          esMia: { type: 'boolean' },
          fecha: { type: 'string', format: 'date' },
          franja: { $ref: '#/components/schemas/Franja' },
          motivo: { type: 'string' },
          propuestaEl: { type: 'string', format: 'date-time' },
        },
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  FranjaOcupada: {
    type: 'object',
    properties: { fecha: { type: 'string', format: 'date' }, franja: { $ref: '#/components/schemas/Franja' } },
  },
  PerfilParaCoordinacion: {
    allOf: [
      { $ref: '#/components/schemas/MiPerfilTutor' },
      {
        type: 'object',
        properties: { estudiante: { type: 'object', properties: { correoInstitucional: { type: 'string' } } } },
      },
    ],
  },
  FilaMetricas: {
    type: 'object',
    properties: {
      solicitudes: { type: 'integer' },
      pendientes: { type: 'integer' },
      confirmadas: { type: 'integer' },
      finalizadas: { type: 'integer' },
      rechazadas: { type: 'integer' },
      canceladas: { type: 'integer' },
      estudiantesAtendidos: { type: 'integer', description: 'Estudiantes distintos con al menos una tutoría finalizada' },
      tutoresVerificados: { type: 'integer' },
      tutoresPendientes: { type: 'integer' },
      calificacionPromedio: { type: 'number', nullable: true },
    },
  },
  Metricas: {
    type: 'object',
    properties: {
      total: { $ref: '#/components/schemas/FilaMetricas' },
      porSede: { type: 'object', additionalProperties: { $ref: '#/components/schemas/FilaMetricas' } },
      motivosCancelacion: {
        type: 'object',
        description: 'Cuántas veces se marcó cada razón en la encuesta de cancelación',
        properties: Object.fromEntries(Object.keys(MotivoCancelacion).map((clave) => [clave, { type: 'integer' }])),
      },
    },
  },
  EncuestaCancelacion: {
    type: 'object',
    required: ['motivos'],
    properties: {
      motivos: {
        type: 'array', minItems: 1, items: { type: 'string', enum: Object.keys(MotivoCancelacion) },
        description: Object.entries(MotivoCancelacion).map(([clave, texto]) => `${clave}: ${texto}`).join('; '),
      },
      motivo: { type: 'string', description: 'Obligatorio si se marca OTRO: entre 5 y 300 caracteres. Por compatibilidad, enviar solo `motivo` equivale a OTRO' },
    },
  },
  Notificacion: {
    type: 'object',
    properties: {
      id: { type: 'string', example: ID_EJEMPLO },
      sesion: { type: 'string', nullable: true },
      tipo: { type: 'string', enum: Object.values(TipoNotificacion) },
      titulo: { type: 'string' },
      texto: { type: 'string' },
      ruta: { type: 'string', description: 'Pantalla del frontend a la que lleva' },
      leida: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
}

export const rutasSesiones = {
  '/sesiones': {
    get: {
      tags: ['Sesiones'],
      summary: 'Lista mis sesiones',
      description: 'Las que pedí y las que atiendo como tutor. El administrador recibe todas, sin datos de contacto.',
      ...conSesion,
      parameters: [
        { name: 'estado', in: 'query', schema: { type: 'string', enum: Object.values(EstadoSesion) } },
        { name: 'papel', in: 'query', description: 'Solo las que pedí o solo las que atiendo', schema: { type: 'string', enum: ['SOLICITANTE', 'TUTOR'] } },
      ],
      responses: {
        200: { description: 'Sesiones, de la más reciente a la más antigua', content: json({ type: 'array', items: { $ref: '#/components/schemas/SesionDetallada' } }) },
        400: error('Filtro mal escrito'),
        ...comunes,
      },
    },
    post: {
      tags: ['Sesiones'],
      summary: 'Solicita una tutoría (estudiante)',
      description:
        'Crea la sesión en estado PENDIENTE. El servidor valida R1 (no a sí mismo), R2 (materia ofrecida), ' +
        'R3 (franja disponible) y R4 (tutor verificado). Un índice único de la base de datos impide que la misma ' +
        'franja del mismo día quede reservada dos veces, aunque las solicitudes lleguen a la vez.',
      ...conSesion,
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/NuevaSesion' }) },
      responses: {
        201: sesionActualizada('Solicitud creada'),
        400: error('Datos no válidos o fecha que no sirve'),
        404: error('El tutor no existe'),
        409: errorDeRegla('Regla incumplida: R1, R2, R3, R4 o RQNF012 (franja ya reservada)'),
        ...privadas,
      },
    },
  },
  '/sesiones/{id}': {
    get: {
      tags: ['Sesiones'],
      summary: 'Consulta una sesión',
      description: 'Solo para quienes participan en ella y para la coordinación.',
      ...conSesion,
      parameters: [idSesion],
      responses: {
        200: sesionActualizada('La sesión'),
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        ...privadas,
      },
    },
  },
  '/sesiones/{id}/confirmar': cambioDeEstado({
    resumen: 'El tutor acepta la solicitud',
    descripcion: 'PENDIENTE -> CONFIRMADA. Solo el tutor de la sesión.',
  }),
  '/sesiones/{id}/rechazar': cambioDeEstado({
    resumen: 'El tutor rechaza la solicitud',
    descripcion: 'PENDIENTE -> RECHAZADA, con motivo. Solo el tutor de la sesión.',
    conMotivo: true,
  }),
  '/sesiones/{id}/cancelar': {
    patch: {
      ...cambioDeEstado({ resumen: 'Cancela la sesión' }).patch,
      description:
        'PENDIENTE o CONFIRMADA -> CANCELADA. Cualquiera de las dos partes. La franja queda libre. ' +
        'Pide la encuesta: una o varias razones y, con OTRO, una explicación. La otra parte recibe una notificación.',
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/EncuestaCancelacion' }) },
    },
  },
  '/sesiones/{id}/finalizar': cambioDeEstado({
    resumen: 'El tutor marca la tutoría como realizada',
    descripcion: 'CONFIRMADA -> FINALIZADA. Solo el tutor de la sesión y desde la hora de inicio de la tutoría: antes responde 409 con regla R5.',
  }),
  '/sesiones/{id}/calificacion': {
    post: {
      tags: ['Sesiones'],
      summary: 'El solicitante califica la tutoría',
      description: 'R6: solo una sesión FINALIZADA y una sola vez. R7: puntaje entero de 1 a 5. Cambia el promedio del tutor.',
      ...conSesion,
      parameters: [idSesion],
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/NuevaCalificacion' }) },
      responses: {
        201: sesionActualizada('Calificación guardada'),
        400: errorDeRegla('R7: puntaje o reseña no válidos'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: errorDeRegla('R6: la sesión no está finalizada o ya fue calificada'),
        ...privadas,
      },
    },
  },
  '/sesiones/{id}/reprogramacion': {
    put: {
      tags: ['Sesiones'],
      summary: 'Propone otra fecha y franja',
      description:
        'Cualquiera de las dos partes, sobre una sesión PENDIENTE o CONFIRMADA. La sesión no cambia hasta que la otra parte acepte.',
      ...conSesion,
      parameters: [idSesion],
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/PropuestaReprogramacion' }) },
      responses: {
        200: sesionActualizada('Propuesta registrada'),
        400: error('Propuesta no válida o igual a la fecha actual'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: conflictoMixto('R3 (franja que el tutor no tiene) o R5 (estado que no lo permite)', 'Ya hay una propuesta pendiente'),
        ...privadas,
      },
    },
    patch: {
      tags: ['Sesiones'],
      summary: 'Acepta o rechaza la propuesta de reprogramación',
      description: 'La responde la parte que NO la propuso. Si acepta, la sesión pasa a la nueva fecha y franja.',
      ...conSesion,
      parameters: [idSesion],
      requestBody: {
        required: true,
        content: json({ type: 'object', required: ['acepta'], properties: { acepta: { type: 'boolean' } } }),
      },
      responses: {
        200: sesionActualizada('Propuesta respondida'),
        400: error('Falta indicar si acepta'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: conflictoMixto('La nueva franja ya fue reservada (RQNF012)', 'No hay propuesta pendiente o ya no está vigente'),
        ...privadas,
      },
    },
  },
  '/tutores/{id}/ocupacion': {
    get: {
      tags: ['Tutores'],
      summary: 'Lista las franjas ya reservadas de un tutor desde hoy',
      description: 'Para que la solicitud y la reprogramación no ofrezcan lo que ya está tomado. No dice quién reservó. Es pública si el perfil está publicado; si no, solo la ven su dueño, Coordinación y quien tiene una tutoría pendiente o confirmada con ese tutor.',
      parameters: [idPerfil],
      responses: {
        200: { description: 'Franjas ocupadas', content: json({ type: 'array', items: { $ref: '#/components/schemas/FranjaOcupada' } }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        ...comunes,
      },
    },
  },
  '/favoritos': {
    get: {
      tags: ['Favoritos'],
      summary: 'Lista mis tutores favoritos (estudiante)',
      ...conSesion,
      responses: {
        200: { description: 'Favoritos que siguen verificados', content: json({ type: 'array', items: { $ref: '#/components/schemas/TutorPublico' } }) },
        ...privadas,
      },
    },
  },
  '/favoritos/{id}': {
    put: {
      tags: ['Favoritos'],
      summary: 'Guarda un tutor como favorito (estudiante)',
      description: 'Marcar dos veces el mismo tutor lo deja una sola vez.',
      ...conSesion,
      parameters: [idPerfil],
      responses: {
        200: { description: 'Lista de favoritos actualizada', content: json({ type: 'array', items: { $ref: '#/components/schemas/TutorPublico' } }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        ...privadas,
      },
    },
    delete: {
      tags: ['Favoritos'],
      summary: 'Quita un tutor de favoritos (estudiante)',
      ...conSesion,
      parameters: [idPerfil],
      responses: {
        200: { description: 'Lista de favoritos actualizada', content: json({ type: 'array', items: { $ref: '#/components/schemas/TutorPublico' } }) },
        400: error('El id no es válido'),
        ...privadas,
      },
    },
  },
  '/notificaciones': {
    get: {
      tags: ['Notificaciones'],
      summary: 'Notificaciones de la campana (estudiante)',
      description:
        'Avisos de cambios en sus sesiones (solicitud nueva, aceptada, rechazada, cancelada, finalizada, calificada, ' +
        'reprogramación) y recordatorios que se crean al consultar: un día antes, una hora antes y al terminar el horario.',
      ...conSesion,
      responses: {
        200: { description: 'Las 40 más recientes', content: json({ type: 'object', properties: {
          sinLeer: { type: 'integer' },
          notificaciones: { type: 'array', items: { $ref: '#/components/schemas/Notificacion' } },
        } }) },
        ...privadas,
      },
    },
  },
  '/notificaciones/leidas': {
    patch: {
      tags: ['Notificaciones'],
      summary: 'Marca todas las notificaciones como leídas (estudiante)',
      ...conSesion,
      responses: { 204: { description: 'Marcadas' }, ...privadas },
    },
  },
  '/coordinacion/cuentas': {
    post: {
      tags: ['Coordinación'],
      summary: 'Crea la cuenta de un estudiante (administrador)',
      description:
        'Uniguajira entrega las credenciales: correo institucional y, como contraseña inicial, el documento de ' +
        'identidad. Al primer ingreso el estudiante debe cambiarla, elegir si quiere enseñar y aceptar el ' +
        'tratamiento de datos (POST /auth/yo/primer-acceso).',
      ...conSesion,
      requestBody: {
        required: true,
        content: json({
          type: 'object', required: ['nombre', 'correoInstitucional', 'documento', 'semestre', 'sede', 'programa'],
          properties: {
            nombre: { type: 'string', minLength: 3, maxLength: 80, example: 'Laura Pérez' },
            correoInstitucional: { type: 'string', example: 'laura.perez@uniguajira.edu.co' },
            documento: { type: 'string', pattern: '^\\d{6,12}$', description: 'Solo dígitos. Es la contraseña inicial; no se guarda en claro' },
            semestre: { type: 'integer', minimum: 1, example: 1 },
            sede: { type: 'string', enum: [...INSTITUCION.sedes] },
            programa: { type: 'string', description: 'Id del programa académico' },
          },
        }),
      },
      responses: {
        201: { description: 'Cuenta creada, pendiente de activar', content: json({ type: 'object', properties: { usuario: { $ref: '#/components/schemas/UsuarioConPerfil' } } }) },
        400: error('Datos no válidos o programa inexistente'),
        409: error('Ya existe una cuenta con ese correo'),
        ...privadas,
      },
    },
  },
  '/coordinacion/perfiles': {
    get: {
      tags: ['Coordinación'],
      summary: 'Lista los perfiles de tutor por estado de verificación (administrador)',
      ...conSesion,
      parameters: [{ name: 'estado', in: 'query', description: 'Por defecto PENDIENTE', schema: { type: 'string', enum: Object.values(EstadoVerificacion) } }],
      responses: {
        200: { description: 'Perfiles, los más antiguos primero', content: json({ type: 'array', items: { $ref: '#/components/schemas/PerfilParaCoordinacion' } }) },
        400: error('Estado no válido'),
        ...privadas,
      },
    },
  },
  '/coordinacion/perfiles/{id}/verificar': {
    patch: {
      tags: ['Coordinación'],
      summary: 'Verifica un perfil de tutor (administrador)',
      description: 'Desde ese momento el tutor aparece en la búsqueda. El perfil debe tener al menos una materia y una franja.',
      ...conSesion,
      parameters: [idPerfil],
      responses: {
        200: { description: 'Perfil verificado', content: json({ $ref: '#/components/schemas/PerfilParaCoordinacion' }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: error('El perfil ya está verificado o está incompleto'),
        ...privadas,
      },
    },
  },
  '/coordinacion/perfiles/{id}/rechazar': {
    patch: {
      tags: ['Coordinación'],
      summary: 'Rechaza un perfil de tutor o le retira la verificación (administrador)',
      ...conSesion,
      parameters: [idPerfil],
      requestBody: cuerpoMotivo,
      responses: {
        200: { description: 'Perfil rechazado', content: json({ $ref: '#/components/schemas/PerfilParaCoordinacion' }) },
        400: error('Falta el motivo o el id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: error('El perfil ya está rechazado'),
        ...privadas,
      },
    },
  },
  '/coordinacion/metricas': {
    get: {
      tags: ['Coordinación'],
      summary: 'Cifras de uso por sede y en total (administrador)',
      description: 'Solo agregados: no incluye nombres ni datos de ninguna persona.',
      ...conSesion,
      responses: {
        200: { description: 'Métricas', content: json({ $ref: '#/components/schemas/Metricas' }) },
        ...privadas,
      },
    },
  },
}
