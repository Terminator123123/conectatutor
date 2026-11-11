import { INSTITUCION } from '../config/institucion.js'
import { DiaSemana, EstadoVerificacion } from '../utils/enums.js'

// Documentación OpenAPI de los tutores (/api/tutores).

const ID_EJEMPLO = '6728f1a2b3c4d5e6f7a8b9c0'
const json = (esquema) => ({ 'application/json': { schema: esquema } })
const error = (descripcion) => ({ description: descripcion, content: json({ $ref: '#/components/schemas/Error' }) })
const conSesion = { security: [{ tokenJWT: [] }] }
const comunes = {
  401: { $ref: '#/components/responses/NoAutenticado' },
  500: { $ref: '#/components/responses/ErrorInterno' },
}

export const esquemasTutores = {
  TutorPublico: {
    type: 'object',
    description: 'Lo que cualquier estudiante ve de un tutor. No incluye correo ni datos de contacto.',
    properties: {
      id: { type: 'string', description: 'Id del perfil de tutor', example: ID_EJEMPLO },
      estudiante: {
        type: 'object',
        properties: {
          id: { type: 'string', example: ID_EJEMPLO },
          nombre: { type: 'string', example: 'Andrea Salcedo' },
          semestre: { type: 'integer', example: 6 },
          sede: { type: 'string', enum: [...INSTITUCION.sedes] },
          programa: { $ref: '#/components/schemas/Programa' },
        },
      },
      biografia: { type: 'string' },
      tarifaHora: { type: 'number', nullable: true, description: 'null si la tutoría es gratuita', example: 35000 },
      estadoVerificacion: { type: 'string', enum: Object.values(EstadoVerificacion) },
      materias: { type: 'array', items: { $ref: '#/components/schemas/MateriaConPrograma' } },
      disponibilidad: { type: 'array', items: { $ref: '#/components/schemas/Franja' } },
      promedio: { type: 'number', description: 'Promedio de calificaciones con un decimal, calculado de las sesiones. 0 si no tiene', example: 4.7 },
      totalCalificaciones: { type: 'integer', example: 3 },
      tutoriasCompletadas: { type: 'integer', description: 'Sesiones finalizadas', example: 5 },
    },
  },
  MiPerfilTutor: {
    allOf: [
      { $ref: '#/components/schemas/TutorPublico' },
      {
        type: 'object',
        properties: { motivoRechazo: { type: 'string', nullable: true, description: 'Motivo del rechazo, si la coordinación lo rechazó' } },
      },
    ],
  },
  DetalleTutor: {
    allOf: [
      { $ref: '#/components/schemas/TutorPublico' },
      {
        type: 'object',
        properties: {
          motivoRechazo: { type: 'string', nullable: true, description: 'Solo lo reciben el dueño del perfil y el administrador' },
          resenas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                puntaje: { type: 'integer', minimum: 1, maximum: 5 },
                resena: { type: 'string' },
                fecha: { type: 'string', format: 'date-time' },
                autor: { type: 'string', description: 'Nombre abreviado de quien calificó', example: 'Elena L.' },
                materia: { type: 'string', nullable: true, example: 'Biología Celular' },
              },
            },
          },
        },
      },
    ],
  },
  DatosPerfilTutor: {
    type: 'object',
    required: ['biografia'],
    properties: {
      biografia: { type: 'string', minLength: 20, maxLength: 500, example: 'Acompaño ejercicios de programación y explico con ejemplos.' },
      tarifaHora: { type: 'number', nullable: true, exclusiveMinimum: true, minimum: 0, maximum: 500000, description: 'null = gratuita', example: null },
      materias: { type: 'array', items: { type: 'string', example: ID_EJEMPLO }, description: 'Ids de materias activas del catálogo, sin repetir' },
      disponibilidad: { type: 'array', items: { $ref: '#/components/schemas/Franja' }, description: 'Franjas semanales que no se solapan' },
    },
  },
}

export const rutasTutores = {
  '/tutores': {
    get: {
      tags: ['Tutores'],
      summary: 'Busca tutores verificados',
      description:
        'Solo devuelve perfiles VERIFICADOS. Todos los filtros son opcionales y se combinan. ' +
        'Ordena por promedio de calificaciones, de mayor a menor.',
      ...conSesion,
      parameters: [
        { name: 'materia', in: 'query', description: 'Id de una materia que el tutor ofrece', schema: { type: 'string' } },
        { name: 'programa', in: 'query', description: 'Id del programa del tutor', schema: { type: 'string' } },
        { name: 'sede', in: 'query', schema: { type: 'string', enum: [...INSTITUCION.sedes] } },
        { name: 'dia', in: 'query', description: 'Día con al menos una franja disponible', schema: { type: 'string', enum: Object.values(DiaSemana) } },
        { name: 'precioMaximo', in: 'query', description: 'Tarifa máxima por hora; las gratuitas siempre entran', schema: { type: 'number', minimum: 0 } },
        { name: 'soloGratuitas', in: 'query', schema: { type: 'boolean' } },
        { name: 'calificacionMinima', in: 'query', description: 'Promedio mínimo', schema: { type: 'number', minimum: 1, maximum: 5 } },
      ],
      responses: {
        200: { description: 'Tutores que cumplen los filtros', content: json({ type: 'array', items: { $ref: '#/components/schemas/TutorPublico' } }) },
        400: error('Algún filtro está mal escrito'),
        ...comunes,
      },
    },
  },
  '/tutores/mi-perfil': {
    get: {
      tags: ['Tutores'],
      summary: 'Devuelve el perfil de tutor propio (estudiante)',
      ...conSesion,
      responses: {
        200: { description: 'El perfil propio', content: json({ $ref: '#/components/schemas/MiPerfilTutor' }) },
        403: { $ref: '#/components/responses/SinPermiso' },
        404: error('Todavía no ha activado su perfil de tutor'),
        ...comunes,
      },
    },
    put: {
      tags: ['Tutores'],
      summary: 'Activa el perfil de tutor propio o guarda sus cambios (estudiante)',
      description:
        'Reemplaza biografía, tarifa, materias y disponibilidad. El perfil nace PENDIENTE y solo el administrador ' +
        'lo verifica. Si estaba RECHAZADO, al guardarlo vuelve a PENDIENTE. No lleva id: siempre es el perfil de quien tiene la sesión.',
      ...conSesion,
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/DatosPerfilTutor' }) },
      responses: {
        200: { description: 'Perfil actualizado', content: json({ $ref: '#/components/schemas/MiPerfilTutor' }) },
        201: { description: 'Perfil activado', content: json({ $ref: '#/components/schemas/MiPerfilTutor' }) },
        400: error('Datos no válidos: biografía corta, tarifa no válida, materia inexistente o franjas que se solapan'),
        403: { $ref: '#/components/responses/SinPermiso' },
        409: error('Dos activaciones del mismo perfil llegaron a la vez: solo una lo crea'),
        ...comunes,
      },
    },
  },
  '/tutores/{id}': {
    get: {
      tags: ['Tutores'],
      summary: 'Devuelve el perfil público de un tutor con sus reseñas',
      description: 'Un perfil que no está verificado solo lo ven su dueño y el administrador; para los demás responde 404.',
      ...conSesion,
      parameters: [{ name: 'id', in: 'path', required: true, description: 'Id del perfil de tutor', schema: { type: 'string', example: ID_EJEMPLO } }],
      responses: {
        200: { description: 'Perfil del tutor', content: json({ $ref: '#/components/schemas/DetalleTutor' }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        ...comunes,
      },
    },
  },
}
