// Documentación OpenAPI del catálogo académico (/api/facultades, /api/programas y /api/materias).

const ID_EJEMPLO = '6728f1a2b3c4d5e6f7a8b9c0'
const json = (esquema) => ({ 'application/json': { schema: esquema } })
const error = (descripcion) => ({ description: descripcion, content: json({ $ref: '#/components/schemas/Error' }) })
const parametroId = (descripcion) => ({
  name: 'id',
  in: 'path',
  required: true,
  description: descripcion,
  schema: { type: 'string', example: ID_EJEMPLO },
})
const idFacultad = parametroId('Id de la facultad')
const idPrograma = parametroId('Id del programa')
const idMateria = parametroId('Id de la materia')
const soloAdministrador = {
  security: [{ tokenJWT: [] }],
}
const respuestasPrivadas = {
  401: { $ref: '#/components/responses/NoAutenticado' },
  403: { $ref: '#/components/responses/SinPermiso' },
  500: { $ref: '#/components/responses/ErrorInterno' },
}

export const esquemasCatalogo = {
  Facultad: {
    type: 'object',
    properties: {
      id: { type: 'string', example: ID_EJEMPLO },
      nombre: { type: 'string', example: 'Facultad de Ingeniería' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  DatosFacultad: {
    type: 'object',
    required: ['nombre'],
    properties: {
      nombre: { type: 'string', minLength: 3, maxLength: 120, example: 'Facultad de Ingeniería' },
    },
  },
  NuevoPrograma: {
    type: 'object',
    required: ['nombre', 'facultad'],
    properties: {
      nombre: { type: 'string', minLength: 3, maxLength: 120, example: 'Ingeniería Agroindustrial' },
      facultad: { type: 'string', description: 'Nombre de una facultad existente', example: 'Facultad de Ingeniería' },
    },
  },
  CambiosPrograma: {
    type: 'object',
    description: 'Al menos un campo',
    properties: {
      nombre: { type: 'string', example: 'Ingeniería Agroindustrial' },
      facultad: { type: 'string', example: 'Facultad de Ingeniería' },
    },
  },
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
      codigo: { type: 'string', minLength: 2, maxLength: 20, description: 'Letras, números y guiones', example: 'SIS-99' },
      nombre: { type: 'string', minLength: 3, maxLength: 120, example: 'Bases de Datos I' },
      programa: { type: 'string', description: 'Id del programa', example: ID_EJEMPLO },
    },
  },
  CambiosMateria: {
    type: 'object',
    description: 'Al menos un campo',
    properties: {
      codigo: { type: 'string', example: 'SIS-99' },
      nombre: { type: 'string', example: 'Bases de Datos' },
      programa: { type: 'string', example: ID_EJEMPLO },
      activa: { type: 'boolean' },
    },
  },
}

export const rutasCatalogo = {
  '/facultades': {
    get: {
      tags: ['Catálogo'],
      summary: 'Lista las facultades',
      responses: {
        200: { description: 'Facultades en orden alfabético', content: json({ type: 'array', items: { $ref: '#/components/schemas/Facultad' } }) },
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
    post: {
      tags: ['Catálogo'],
      summary: 'Crea una facultad (administrador)',
      ...soloAdministrador,
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/DatosFacultad' }) },
      responses: {
        201: { description: 'Facultad creada', content: json({ $ref: '#/components/schemas/Facultad' }) },
        400: error('Datos no válidos'),
        409: error('Ya existe una facultad con ese nombre'),
        ...respuestasPrivadas,
      },
    },
  },
  '/facultades/{id}': {
    get: {
      tags: ['Catálogo'],
      summary: 'Consulta una facultad',
      parameters: [idFacultad],
      responses: {
        200: { description: 'La facultad', content: json({ $ref: '#/components/schemas/Facultad' }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
    put: {
      tags: ['Catálogo'],
      summary: 'Cambia el nombre de una facultad (administrador)',
      description: 'También cambia el nombre de la facultad en sus programas.',
      ...soloAdministrador,
      parameters: [idFacultad],
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/DatosFacultad' }) },
      responses: {
        200: { description: 'Facultad actualizada', content: json({ $ref: '#/components/schemas/Facultad' }) },
        400: error('Datos no válidos o id mal formado'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: error('Ya existe una facultad con ese nombre'),
        ...respuestasPrivadas,
      },
    },
    delete: {
      tags: ['Catálogo'],
      summary: 'Borra una facultad (administrador)',
      description: 'Solo si no tiene programas.',
      ...soloAdministrador,
      parameters: [idFacultad],
      responses: {
        200: { description: 'Facultad borrada', content: json({ $ref: '#/components/schemas/Facultad' }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: error('La facultad tiene programas'),
        ...respuestasPrivadas,
      },
    },
  },
  '/programas': {
    get: {
      tags: ['Catálogo'],
      summary: 'Lista los programas académicos',
      responses: {
        200: { description: 'Programas en orden alfabético', content: json({ type: 'array', items: { $ref: '#/components/schemas/Programa' } }) },
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
    post: {
      tags: ['Catálogo'],
      summary: 'Crea un programa académico (administrador)',
      ...soloAdministrador,
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/NuevoPrograma' }) },
      responses: {
        201: { description: 'Programa creado', content: json({ $ref: '#/components/schemas/Programa' }) },
        400: error('Datos no válidos o facultad inexistente'),
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
        400: error('Datos no válidos, id mal formado o facultad inexistente'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        409: error('Ya existe un programa con ese nombre'),
        ...respuestasPrivadas,
      },
    },
    delete: {
      tags: ['Catálogo'],
      summary: 'Borra un programa académico (administrador)',
      description: 'Solo si no tiene materias ni estudiantes.',
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
      description: 'Devuelve las materias activas. Con el token de administrador e `incluirInactivas=true` incluye las retiradas.',
      security: [{}, { tokenJWT: [] }],
      parameters: [
        { name: 'programa', in: 'query', description: 'Id del programa', schema: { type: 'string' } },
        { name: 'incluirInactivas', in: 'query', description: 'Solo para el administrador', schema: { type: 'boolean' } },
      ],
      responses: {
        200: { description: 'Materias ordenadas por código', content: json({ type: 'array', items: { $ref: '#/components/schemas/MateriaConPrograma' } }) },
        400: error('El filtro programa no es un id válido'),
        401: error('El token no es válido o ya expiró'),
        500: { $ref: '#/components/responses/ErrorInterno' },
      },
    },
    post: {
      tags: ['Catálogo'],
      summary: 'Crea una materia (administrador)',
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
      summary: 'Retira una materia (administrador)',
      description: 'Marca la materia como inactiva y la quita de los perfiles de tutor. Las sesiones registradas no cambian.',
      ...soloAdministrador,
      parameters: [idMateria],
      responses: {
        200: { description: 'Materia retirada', content: json({ $ref: '#/components/schemas/MateriaConPrograma' }) },
        400: error('El id no es válido'),
        404: { $ref: '#/components/responses/NoEncontrado' },
        ...respuestasPrivadas,
      },
    },
  },
}
