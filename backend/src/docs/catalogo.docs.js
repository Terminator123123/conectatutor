// Documentación OpenAPI del catálogo académico (/api/programas y /api/materias).

const ID_EJEMPLO = '6728f1a2b3c4d5e6f7a8b9c0'
const json = (esquema) => ({ 'application/json': { schema: esquema } })
const error = (descripcion) => ({ description: descripcion, content: json({ $ref: '#/components/schemas/Error' }) })
const idMateria = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Id de la materia (24 caracteres hexadecimales)',
  schema: { type: 'string', example: ID_EJEMPLO },
}
const idPrograma = { ...idMateria, description: 'Id del programa (24 caracteres hexadecimales)' }
const soloAdministrador = {
  security: [{ tokenJWT: [] }],
}
const respuestasPrivadas = {
  401: { $ref: '#/components/responses/NoAutenticado' },
  403: { $ref: '#/components/responses/SinPermiso' },
  500: { $ref: '#/components/responses/ErrorInterno' },
}

export const esquemasCatalogo = {
  NuevoPrograma: {
    type: 'object',
    required: ['nombre', 'facultad'],
    properties: {
      nombre: { type: 'string', minLength: 3, maxLength: 120, description: 'Único', example: 'Ingeniería Agroindustrial' },
      facultad: { type: 'string', minLength: 3, maxLength: 120, example: 'Facultad de Ingeniería' },
    },
  },
  CambiosPrograma: {
    type: 'object',
    description: 'Se envían solo los campos que cambian (al menos uno)',
    properties: {
      nombre: { type: 'string', example: 'Ingeniería Agroindustrial' },
      facultad: { type: 'string', example: 'Facultad de Ingeniería' },
    },
  },
  // Se describe completa: en Materia `programa` es un id y aquí llega el programa entero.
  MateriaConPrograma: {
    type: 'object',
    properties: {
      id: { type: 'string', example: ID_EJEMPLO },
      codigo: { type: 'string', example: 'SIS-04' },
      nombre: { type: 'string', example: 'Algoritmo y Programación I' },
      programa: { $ref: '#/components/schemas/Programa' },
      activa: { type: 'boolean', example: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  NuevaMateria: {
    type: 'object',
    required: ['codigo', 'nombre', 'programa'],
    properties: {
      codigo: { type: 'string', minLength: 2, maxLength: 20, description: 'Letras, números y guiones. Único', example: 'SIS-09' },
      nombre: { type: 'string', minLength: 3, maxLength: 120, example: 'Bases de Datos I' },
      programa: { type: 'string', description: 'Id del programa', example: ID_EJEMPLO },
    },
  },
  CambiosMateria: {
    type: 'object',
    description: 'Se envían solo los campos que cambian (al menos uno)',
    properties: {
      codigo: { type: 'string', example: 'SIS-09' },
      nombre: { type: 'string', example: 'Bases de Datos' },
      programa: { type: 'string', example: ID_EJEMPLO },
      activa: { type: 'boolean', description: 'true vuelve a poner en el catálogo una materia retirada' },
    },
  },
}

export const rutasCatalogo = {
  '/programas': {
    get: {
      tags: ['Catálogo'],
      summary: 'Lista los programas académicos',
      description: 'Pública: el formulario de registro la necesita antes de tener sesión.',
      responses: {
        200: { description: 'Programas en orden alfabético', content: json({ type: 'array', items: { $ref: '#/components/schemas/Programa' } }) },
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
    post: {
      tags: ['Catálogo'],
      summary: 'Agrega un programa académico (administrador)',
      description:
        'Solo por la API: la aplicación web no tiene pantalla para esto. Sirve para registrar un programa nuevo ' +
        'que abra Uniguajira sin tocar el código. Exige el token de Coordinación y el nombre no se puede repetir.',
      ...soloAdministrador,
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/NuevoPrograma' }) },
      responses: {
        201: { description: 'Programa creado', content: json({ $ref: '#/components/schemas/Programa' }) },
        400: error('Datos no válidos'),
        409: error('Ya existe un programa con ese nombre'),
        ...respuestasPrivadas,
      },
    },
  },
  '/programas/{id}': {
    get: {
      tags: ['Catálogo'],
      summary: 'Consulta un programa académico',
      parameters: [idPrograma],
      responses: {
        200: { description: 'El programa', content: json({ $ref: '#/components/schemas/Programa' }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
    put: {
      tags: ['Catálogo'],
      summary: 'Edita un programa académico (administrador)',
      ...soloAdministrador,
      parameters: [idPrograma],
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/CambiosPrograma' }) },
      responses: {
        200: { description: 'Programa actualizado', content: json({ $ref: '#/components/schemas/Programa' }) },
        400: error('Datos no válidos o id mal formado'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: error('Ya existe un programa con ese nombre'),
        ...respuestasPrivadas,
      },
    },
    delete: {
      tags: ['Catálogo'],
      summary: 'Borra un programa académico sin uso (administrador)',
      description:
        'Solo se puede borrar un programa sin materias ni estudiantes. Si los tiene responde 409: ' +
        'primero hay que mover esas materias y cuentas a otro programa.',
      ...soloAdministrador,
      parameters: [idPrograma],
      responses: {
        200: { description: 'Programa borrado', content: json({ $ref: '#/components/schemas/Programa' }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: error('El programa tiene materias o estudiantes'),
        ...respuestasPrivadas,
      },
    },
  },
  '/materias': {
    get: {
      tags: ['Catálogo'],
      summary: 'Lista las materias del catálogo',
      description:
        'Pública. Devuelve solo las materias activas. Si quien consulta es el administrador (envía su token) ' +
        'y agrega `incluirInactivas=true`, también ve las retiradas.',
      security: [{}, { tokenJWT: [] }],
      parameters: [
        { name: 'programa', in: 'query', description: 'Id del programa', schema: { type: 'string' } },
        { name: 'incluirInactivas', in: 'query', description: 'Solo tiene efecto para el administrador', schema: { type: 'boolean' } },
      ],
      responses: {
        200: { description: 'Materias ordenadas por código', content: json({ type: 'array', items: { $ref: '#/components/schemas/MateriaConPrograma' } }) },
        400: error('El filtro programa no es un id válido'),
        401: error('Se envió un token que no es válido o ya expiró'),
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
    post: {
      tags: ['Catálogo'],
      summary: 'Agrega una materia al catálogo (administrador)',
      ...soloAdministrador,
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/NuevaMateria' }) },
      responses: {
        201: { description: 'Materia creada', content: json({ $ref: '#/components/schemas/MateriaConPrograma' }) },
        400: error('Datos no válidos o programa inexistente'),
        409: error('Ya existe una materia con ese código'),
        ...respuestasPrivadas,
      },
    },
  },
  '/materias/{id}': {
    get: {
      tags: ['Catálogo'],
      summary: 'Consulta una materia',
      parameters: [idMateria],
      responses: {
        200: { description: 'La materia', content: json({ $ref: '#/components/schemas/MateriaConPrograma' }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
    put: {
      tags: ['Catálogo'],
      summary: 'Edita una materia (administrador)',
      ...soloAdministrador,
      parameters: [idMateria],
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/CambiosMateria' }) },
      responses: {
        200: { description: 'Materia actualizada', content: json({ $ref: '#/components/schemas/MateriaConPrograma' }) },
        400: error('Datos no válidos, id mal formado o programa inexistente'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: error('Ya existe una materia con ese código'),
        ...respuestasPrivadas,
      },
    },
    delete: {
      tags: ['Catálogo'],
      summary: 'Retira una materia del catálogo (administrador)',
      description:
        'Borrado lógico: la materia queda con `activa: false`, deja de aparecer en el catálogo y en las búsquedas ' +
        'y se quita de los perfiles que la ofrecían. Las sesiones ya registradas la conservan.',
      ...soloAdministrador,
      parameters: [idMateria],
      responses: {
        200: { description: 'Materia desactivada', content: json({ $ref: '#/components/schemas/MateriaConPrograma' }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        ...respuestasPrivadas,
      },
    },
  },
}
