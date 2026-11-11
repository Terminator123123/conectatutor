import { INSTITUCION } from '../config/institucion.js'
import { esquemasAuth, rutasAuth } from './auth.docs.js'
import { esquemasCatalogo, rutasCatalogo } from './catalogo.docs.js'
import { esquemasSesiones, rutasSesiones } from './sesiones.docs.js'
import { esquemasTutores, rutasTutores } from './tutores.docs.js'
import { DiaSemana, EstadoSesion, EstadoVerificacion, RolUsuario } from '../utils/enums.js'

// DOCUMENTACIÓN DE LA API en formato OpenAPI 3: es lo que lee Swagger en /api/docs.
// Se escribe a mano y se amplía con cada grupo de rutas que se agrega.

const ID_EJEMPLO = '6728f1a2b3c4d5e6f7a8b9c0'
const marcasDeTiempo = {
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
}

export const documentacion = {
  openapi: '3.0.3',
  info: {
    title: 'API de ConectaTutor Uniguajira',
    version: '1.0.0',
    description:
      'API REST de tutorías entre estudiantes de la Universidad de La Guajira. ' +
      'Organizada por capas: rutas, controladores, servicios y modelos. ' +
      'Todas las respuestas de error tienen la forma `{ mensaje, errores? }`.',
  },
  // Ruta relativa: Swagger llama a la misma dirección desde la que se abrió, en local o en producción.
  servers: [{ url: '/api', description: 'Este servidor' }],
  tags: [
    { name: 'Estado', description: 'Comprobación de que la API y la base de datos responden' },
    { name: 'Autenticación', description: 'Registro, ingreso y datos de la cuenta propia' },
    { name: 'Catálogo', description: 'Programas académicos y materias. Leer es público; cambiar materias es del administrador' },
    { name: 'Tutores', description: 'Perfil de tutor propio, búsqueda de tutores verificados y perfil público' },
    { name: 'Sesiones', description: 'Solicitud, respuesta del tutor, cancelación, calificación y reprogramación' },
    { name: 'Favoritos', description: 'Tutores guardados por el estudiante' },
    { name: 'Coordinación', description: 'Verificación de tutores y cifras de uso. Solo administrador' },
  ],

  components: {
    securitySchemes: {
      // Lo usan las rutas privadas: encabezado Authorization: Bearer <token>
      tokenJWT: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ...esquemasAuth,
      ...esquemasCatalogo,
      ...esquemasTutores,
      ...esquemasSesiones,
      Error: {
        type: 'object',
        required: ['mensaje'],
        properties: {
          mensaje: { type: 'string', example: 'Los datos enviados no son válidos' },
          regla: { type: 'string', description: 'Regla de negocio incumplida, cuando aplica', example: 'R5' },
          errores: {
            type: 'array',
            items: { type: 'string' },
            example: ['El nombre es obligatorio'],
          },
        },
      },
      Salud: {
        type: 'object',
        properties: {
          estado: { type: 'string', example: 'ok' },
          baseDeDatos: { type: 'string', enum: ['conectada', 'desconectada'] },
          fecha: { type: 'string', format: 'date-time' },
        },
      },
      Programa: {
        type: 'object',
        properties: {
          id: { type: 'string', example: ID_EJEMPLO },
          nombre: { type: 'string', example: 'Ingeniería de Sistemas' },
          facultad: { type: 'string', example: 'Facultad de Ingeniería' },
          ...marcasDeTiempo,
        },
      },
      Materia: {
        type: 'object',
        properties: {
          id: { type: 'string', example: ID_EJEMPLO },
          codigo: { type: 'string', example: 'SIS-04' },
          nombre: { type: 'string', example: 'Algoritmo y Programación I' },
          programa: { type: 'string', description: 'Id del programa', example: ID_EJEMPLO },
          activa: { type: 'boolean', example: true },
          ...marcasDeTiempo,
        },
      },
      Franja: {
        type: 'object',
        required: ['dia', 'horaInicio', 'horaFin'],
        properties: {
          dia: { type: 'string', enum: Object.values(DiaSemana) },
          horaInicio: { type: 'string', example: '08:00', description: 'Formato HH:MM' },
          horaFin: { type: 'string', example: '10:00', description: 'Formato HH:MM, posterior a la hora de inicio' },
        },
      },
      Usuario: {
        type: 'object',
        description: 'Estudiante o administrador, según `tipo`. La contraseña nunca se incluye.',
        properties: {
          id: { type: 'string', example: ID_EJEMPLO },
          tipo: { type: 'string', enum: Object.values(RolUsuario) },
          nombre: { type: 'string', example: 'Elena Lozano' },
          correoInstitucional: { type: 'string', example: `elena.lozano@${INSTITUCION.dominioCorreo}` },
          semestre: { type: 'integer', minimum: 1, maximum: INSTITUCION.semestreMaximo, description: 'Solo estudiante' },
          sede: { type: 'string', enum: [...INSTITUCION.sedes], description: 'Solo estudiante' },
          programa: { type: 'string', description: 'Id del programa. Solo estudiante', example: ID_EJEMPLO },
          quiereSerTutor: { type: 'boolean', description: 'Lo que eligió al registrarse. Solo estudiante' },
          favoritos: { type: 'array', items: { type: 'string' }, description: 'Ids de los perfiles de tutor guardados como favoritos. Solo estudiante' },
          dependencia: { type: 'string', description: 'Solo administrador' },
          consentimientoDatos: {
            type: 'object',
            properties: {
              aceptado: { type: 'boolean' },
              fecha: { type: 'string', format: 'date-time', nullable: true },
            },
          },
          ...marcasDeTiempo,
        },
      },
      PerfilTutor: {
        type: 'object',
        properties: {
          id: { type: 'string', example: ID_EJEMPLO },
          estudiante: { type: 'string', description: 'Id del estudiante dueño del perfil', example: ID_EJEMPLO },
          biografia: { type: 'string', minLength: 20, maxLength: 500 },
          tarifaHora: { type: 'number', nullable: true, description: 'null si la tutoría es gratuita', example: 35000 },
          estadoVerificacion: { type: 'string', enum: Object.values(EstadoVerificacion) },
          motivoRechazo: { type: 'string', nullable: true },
          materias: { type: 'array', items: { type: 'string', example: ID_EJEMPLO } },
          disponibilidad: { type: 'array', items: { $ref: '#/components/schemas/Franja' } },
          ...marcasDeTiempo,
        },
      },
      Calificacion: {
        type: 'object',
        required: ['puntaje'],
        properties: {
          puntaje: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
          resena: { type: 'string', maxLength: 500 },
          fecha: { type: 'string', format: 'date-time' },
        },
      },
      Sesion: {
        type: 'object',
        properties: {
          id: { type: 'string', example: ID_EJEMPLO },
          solicitante: { type: 'string', description: 'Id del estudiante que pide la tutoría', example: ID_EJEMPLO },
          tutor: { type: 'string', description: 'Id del perfil de tutor', example: ID_EJEMPLO },
          materia: { type: 'string', description: 'Id de la materia', example: ID_EJEMPLO },
          fecha: { type: 'string', format: 'date-time', description: 'Día de la tutoría (00:00 UTC)' },
          franja: { $ref: '#/components/schemas/Franja' },
          tema: { type: 'string', minLength: 10, maxLength: 300 },
          estado: { type: 'string', enum: Object.values(EstadoSesion) },
          motivo: { type: 'string', nullable: true, description: 'Motivo del rechazo o de la cancelación' },
          calificacion: { allOf: [{ $ref: '#/components/schemas/Calificacion' }], nullable: true },
          ...marcasDeTiempo,
        },
      },
    },
    responses: {
      NoAutenticado: {
        description: 'Falta el token, no es válido o ya expiró',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NoEncontrado: {
        description: 'El recurso no existe',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      SinPermiso: {
        description: 'El usuario no tiene el rol que exige la ruta',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      ErrorInterno: {
        description: 'Error interno del servidor',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },

  // Cada ruta de la API, con lo que recibe y lo que responde
  paths: {
    '/salud': {
      get: {
        tags: ['Estado'],
        summary: 'Comprueba que la API está encendida',
        description: 'Responde siempre 200 si el servidor está arriba e indica si la base de datos está conectada.',
        responses: {
          200: {
            description: 'La API responde',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Salud' } } },
          },
          500: { $ref: '#/components/responses/ErrorInterno' },
        },
      },
    },
    ...rutasAuth,
    ...rutasCatalogo,
    ...rutasTutores,
    ...rutasSesiones,
  },
}
