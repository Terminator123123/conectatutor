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
      primerAccesoPendiente: { type: 'boolean', description: 'true en cuentas creadas por Coordinación que aún no completan el primer acceso' },
      favoritos: { type: 'array', items: { type: 'string' }, description: 'Ids de los perfiles de tutor guardados como favoritos. Solo estudiante' },
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
  CambiosCuenta: {
    type: 'object',
    description: 'Solo los campos que cambian (al menos uno). El correo y el rol no se pueden cambiar.',
    properties: {
      nombre: { type: 'string', minLength: 3, maxLength: 80 },
      semestre: { type: 'integer', minimum: 1, maximum: INSTITUCION.semestreMaximo, description: 'Solo estudiante' },
      sede: { type: 'string', enum: [...INSTITUCION.sedes], description: 'Solo estudiante' },
      programa: { type: 'string', description: 'Id del programa. Solo estudiante', example: ID_EJEMPLO },
      dependencia: { type: 'string', description: 'Solo administrador' },
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
  '/auth/recuperacion': {
    post: {
      tags: ['Autenticación'],
      summary: 'Pide un enlace para crear una contraseña nueva',
      description:
        'Envía al correo institucional un enlace que vence en 30 minutos y sirve una sola vez. ' +
        'La respuesta es la misma si el correo no está registrado, también si el envío falla. ' +
        'Máximo 3 pedidos cada 15 minutos. En producción sin cuenta de correo configurada responde 503 y no genera enlaces.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['correoInstitucional'],
          properties: { correoInstitucional: { type: 'string', example: `elena.lozano@${INSTITUCION.dominioCorreo}` } },
        } } },
      },
      responses: {
        202: { description: 'Pedido recibido', content: { 'application/json': { schema: { type: 'object', properties: { mensaje: { type: 'string' } } } } } },
        400: error('El correo no es institucional'),
        429: error('Demasiados pedidos seguidos'),
        500: { $ref: '#/components/responses/ErrorInterno' },
        503: error('El servidor no tiene cómo enviar correos'),
      },
    },
  },
  '/auth/recuperacion/comprobar': {
    post: {
      tags: ['Autenticación'],
      summary: 'Comprueba que un enlace de recuperación siga vigente',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } } },
      },
      responses: {
        200: { description: 'Enlace vigente', content: { 'application/json': { schema: { type: 'object', properties: { vigente: { type: 'boolean' } } } } } },
        400: error('El enlace venció o ya se usó'),
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
  },
  '/auth/recuperacion/restablecer': {
    post: {
      tags: ['Autenticación'],
      summary: 'Cambia la contraseña con un enlace de recuperación vigente',
      description: 'El enlace queda inutilizado después de usarlo.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['token', 'clave'],
          properties: { token: { type: 'string' }, clave: { type: 'string', example: 'NuevaClave2' } },
        } } },
      },
      responses: {
        200: { description: 'Contraseña actualizada', content: { 'application/json': { schema: { type: 'object', properties: { mensaje: { type: 'string' } } } } } },
        400: error('El enlace venció, ya se usó, o la contraseña no cumple las reglas'),
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
  },
  '/auth/yo/primer-acceso': {
    post: {
      tags: ['Autenticación'],
      summary: 'Activa una cuenta creada por Coordinación',
      description:
        'Primer ingreso con el documento como contraseña: crea la contraseña propia, elige si también quiere ' +
        'enseñar (RQF002) y acepta el tratamiento de datos (RQNF009). Mientras no se complete, la cuenta solo ' +
        'puede consultar: cualquier otra ruta que cambie datos responde 403 con la regla PRIMER_ACCESO.',
      security: [{ tokenJWT: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['claveNueva', 'quiereSerTutor', 'aceptaTratamientoDatos'],
          properties: {
            claveNueva: { type: 'string', example: 'NuevaClave2', description: 'Distinta del documento de identidad' },
            quiereSerTutor: { type: 'boolean', description: 'false = quiero aprender, true = también quiero enseñar' },
            aceptaTratamientoDatos: { type: 'boolean', example: true, description: 'Debe ser true (Ley 1581 de 2012)' },
          },
        } } },
      },
      responses: {
        200: { description: 'Cuenta activada', content: { 'application/json': { schema: { type: 'object', properties: { usuario: { $ref: '#/components/schemas/UsuarioConPerfil' } } } } } },
        400: error('Contraseña débil o igual al documento, falta elegir el uso o falta el consentimiento'),
        401: { $ref: '#/components/responses/NoAutenticado' },
        409: error('La cuenta ya estaba activada'),
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
  },
  '/auth/yo/clave': {
    put: {
      tags: ['Autenticación'],
      summary: 'Cambia la contraseña de la cuenta propia',
      description: 'Pide la contraseña actual. Si no coincide responde 400: la sesión sigue activa.',
      security: [{ tokenJWT: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['claveActual', 'claveNueva'],
          properties: { claveActual: { type: 'string' }, claveNueva: { type: 'string', example: 'NuevaClave2' } },
        } } },
      },
      responses: {
        200: { description: 'Contraseña actualizada', content: { 'application/json': { schema: { type: 'object', properties: { mensaje: { type: 'string' } } } } } },
        400: error('La contraseña actual no es correcta o la nueva no cumple las reglas'),
        401: { $ref: '#/components/responses/NoAutenticado' },
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
  },
  '/auth/yo/foto': {
    put: {
      tags: ['Autenticación'],
      summary: 'Cambia la foto de perfil',
      description: 'Imagen JPG, PNG o WebP en data URL, máximo 200 KB. El formato se comprueba por el contenido del archivo.',
      security: [{ tokenJWT: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['imagen'], properties: { imagen: { type: 'string', example: 'data:image/webp;base64,UklGR...' } } } } },
      },
      responses: {
        200: { description: 'Foto actualizada', content: { 'application/json': { schema: { type: 'object', properties: { mensaje: { type: 'string' } } } } } },
        400: error('No es una imagen admitida o pesa demasiado'),
        401: { $ref: '#/components/responses/NoAutenticado' },
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
    delete: {
      tags: ['Autenticación'],
      summary: 'Quita la foto de perfil',
      security: [{ tokenJWT: [] }],
      responses: {
        204: { description: 'Foto quitada' },
        401: { $ref: '#/components/responses/NoAutenticado' },
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
  },
  '/usuarios/{id}/foto': {
    get: {
      tags: ['Autenticación'],
      summary: 'Devuelve la foto de perfil de un usuario',
      description: 'Pública. Responde 204 sin cuerpo si no tiene foto, para mostrar las iniciales.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', example: ID_EJEMPLO } }],
      responses: {
        200: { description: 'La imagen', content: { 'image/webp': {}, 'image/jpeg': {}, 'image/png': {} } },
        204: { description: 'El usuario no tiene foto' },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
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
    patch: {
      tags: ['Autenticación'],
      summary: 'Edita los datos de la cuenta propia',
      description: 'El estudiante no puede cambiar nombre, programa, semestre ni sede: los actualiza la Universidad (403). ' +
        'El administrador puede cambiar su nombre y su dependencia.',
      security: [{ tokenJWT: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CambiosCuenta' } } } },
      responses: {
        200: {
          description: 'Cuenta actualizada',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { usuario: { $ref: '#/components/schemas/UsuarioConPerfil' } } },
            },
          },
        },
        400: error('Datos no válidos o ningún campo para cambiar'),
        401: { $ref: '#/components/responses/NoAutenticado' },
        403: error('Esos datos los actualiza la Universidad'),
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
  },
}
