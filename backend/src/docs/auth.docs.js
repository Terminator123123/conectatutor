import { INSTITUCION } from '../config/institucion.js'
import { EstadoVerificacion, RolUsuario } from '../utils/enums.js'

// Documentación OpenAPI de las rutas de autenticación (/api/auth).

const ID_EJEMPLO = '6728f1a2b3c4d5e6f7a8b9c0'
const error = (descripcion) => ({
  description: descripcion,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
})

export const esquemasAuth = {
  DatosRegistro: {
    type: 'object',
    required: ['nombre', 'correoInstitucional', 'clave', 'semestre', 'sede', 'programa', 'aceptaTratamientoDatos'],
    properties: {
      nombre: { type: 'string', minLength: 3, maxLength: 80, example: 'Elena Lozano' },
      correoInstitucional: {
        type: 'string',
        description: `Debe terminar en @${INSTITUCION.dominioCorreo}`,
        example: `elena.lozano@${INSTITUCION.dominioCorreo}`,
      },
      clave: {
        type: 'string',
        format: 'password',
        minLength: 8,
        description:
          'Al menos 8 caracteres, con letras y números, y máximo 72 bytes en UTF-8: las letras con tilde y la ñ ' +
          'ocupan 2 bytes, así que el tope en caracteres puede ser menor que 72. Se guarda cifrada y nunca se devuelve.',
      },
      semestre: { type: 'integer', minimum: 1, maximum: INSTITUCION.semestreMaximo, example: 2 },
      sede: { type: 'string', enum: [...INSTITUCION.sedes] },
      programa: { type: 'string', description: 'Id de un programa académico', example: ID_EJEMPLO },
      aceptaTratamientoDatos: {
        type: 'boolean',
        description: 'Debe ser true: consentimiento del tratamiento de datos personales (Ley 1581 de 2012)',
        example: true,
      },
      quiereSerTutor: {
        type: 'boolean',
        default: false,
        description: 'Uso elegido al registrarse: false = quiero aprender, true = quiero enseñar',
      },
    },
  },
  DatosIngreso: {
    type: 'object',
    required: ['correoInstitucional', 'clave'],
    properties: {
      correoInstitucional: { type: 'string', example: `elena.lozano@${INSTITUCION.dominioCorreo}` },
      clave: { type: 'string', format: 'password' },
    },
  },
  // Se describe completo y no como extensión de Usuario: allí `programa` es un id (texto)
  // y aquí llega el programa entero (objeto). Con allOf se exigirían las dos cosas a la vez.
  UsuarioConPerfil: {
    type: 'object',
    description: 'La cuenta tal como la devuelven registro, ingreso y cuenta propia. Nunca incluye la contraseña.',
    properties: {
      id: { type: 'string', example: ID_EJEMPLO },
      tipo: { type: 'string', enum: Object.values(RolUsuario) },
      nombre: { type: 'string', example: 'Elena Lozano' },
      correoInstitucional: { type: 'string', example: `elena.lozano@${INSTITUCION.dominioCorreo}` },
      consentimientoDatos: {
        type: 'object',
        properties: {
          aceptado: { type: 'boolean' },
          fecha: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      semestre: { type: 'integer', minimum: 1, maximum: INSTITUCION.semestreMaximo, description: 'Solo estudiante' },
      sede: { type: 'string', enum: [...INSTITUCION.sedes], description: 'Solo estudiante' },
      programa: { $ref: '#/components/schemas/Programa' },
      quiereSerTutor: { type: 'boolean', description: 'Lo que eligió al registrarse. Solo estudiante' },
      dependencia: { type: 'string', description: 'Solo administrador' },
      perfilTutor: {
        type: 'object',
        nullable: true,
        description: 'Resumen del perfil de tutor, o null si no lo ha activado (siempre null en el administrador)',
        properties: {
          id: { type: 'string', example: ID_EJEMPLO },
          estadoVerificacion: { type: 'string', enum: Object.values(EstadoVerificacion) },
        },
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  SesionIniciada: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'Token JWT. Se envía en las rutas privadas como `Authorization: Bearer <token>`',
      },
      usuario: { $ref: '#/components/schemas/UsuarioConPerfil' },
    },
  },
}

export const rutasAuth = {
  '/auth/registro': {
    post: {
      tags: ['Autenticación'],
      summary: 'Crea la cuenta de un estudiante',
      description:
        'Solo acepta correos del dominio institucional. Guarda la contraseña cifrada y la fecha en que se ' +
        'aceptó el tratamiento de datos. Devuelve el token: la persona queda con la sesión iniciada.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/DatosRegistro' } } },
      },
      responses: {
        201: {
          description: 'Cuenta creada',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SesionIniciada' } } },
        },
        400: error('Datos no válidos: correo que no es institucional, contraseña débil, falta el consentimiento...'),
        409: error('Ya existe una cuenta con ese correo'),
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
  },
  '/auth/ingreso': {
    post: {
      tags: ['Autenticación'],
      summary: 'Inicia sesión',
      description:
        'Devuelve un token JWT con caducidad. La respuesta es la misma si el correo no existe o si la ' +
        'contraseña es incorrecta. Tras 5 intentos fallidos seguidos hay que esperar 15 minutos.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/DatosIngreso' } } },
      },
      responses: {
        200: {
          description: 'Sesión iniciada',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SesionIniciada' } } },
        },
        400: error('Falta el correo o la contraseña'),
        401: error('El correo o la contraseña no son correctos'),
        429: error('Demasiados intentos fallidos'),
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
  },
  '/auth/yo': {
    get: {
      tags: ['Autenticación'],
      summary: 'Devuelve los datos de la cuenta con la sesión iniciada',
      security: [{ tokenJWT: [] }],
      responses: {
        200: {
          description: 'Datos de la cuenta',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { usuario: { $ref: '#/components/schemas/UsuarioConPerfil' } },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/NoAutenticado' },
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
  },
}
