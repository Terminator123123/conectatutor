import { writeFile } from 'node:fs/promises'

const evento = (listen, codigo) => ({ listen, script: { type: 'text/javascript', exec: codigo.trim().split('\n') } })
const v = clave => `{{${clave}}}`
const franja = { dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00' }
const perfil = { biografia: 'Acompaño el estudio con ejemplos y ejercicios de aplicación', tarifaHora: null, materias: [v('materiaId')], disponibilidad: [franja] }
const registro = (tutor, cambios = {}) => ({ nombre: tutor ? 'Tutor de pruebas' : 'Solicitante de pruebas', correoInstitucional: `qa.${tutor ? 'tutor' : 'solicitante'}.${v('sufijo')}@uniguajira.edu.co`, clave: v('clave'), semestre: 3, sede: 'Riohacha', programa: v('programaId'), aceptaTratamientoDatos: true, quiereSerTutor: tutor, ...cambios })
const solicitud = (cambios = {}) => ({ tutor: v('perfilId'), materia: v('materiaId'), fecha: v('fecha'), franja, tema: 'Repasar ejercicios de álgebra', ...cambios })
const grupos = new Map()

function caso(grupo, nombre, metodo, ruta, estado, { actor, cuerpo, comprobar = '', regla } = {}) {
  const codigo = `pm.test(${JSON.stringify(nombre)}, function () {
  function asegurar(condicion, mensaje) { if (!condicion) throw new Error(mensaje); }
  asegurar(pm.response.code === ${estado}, 'HTTP esperado ${estado}; recibido ' + pm.response.code);
  const datos = pm.response.json();
  ${regla ? `asegurar(datos.regla === '${regla}', 'Regla esperada ${regla}');` : ''}
  ${comprobar}
});`
  const item = {
    name: nombre,
    request: {
      method: metodo,
      header: [...(actor ? [{ key: 'Authorization', value: `Bearer ${v(`${actor}Token`)}` }] : []), ...(cuerpo ? [{ key: 'Content-Type', value: 'application/json' }] : [])],
      url: `{{baseUrl}}${ruta}`,
      ...(cuerpo ? { body: { mode: 'raw', raw: JSON.stringify(cuerpo, null, 2), options: { raw: { language: 'json' } } } } : {}),
      description: `Precondición: API local aislada con datos ficticios y ejecución ordenada de la colección. Paso: ${metodo} ${ruta}. Resultado esperado: HTTP ${estado}${regla ? ` y regla ${regla}` : ''}. Ver comprobaciones en Tests.`,
    },
    event: [evento('test', codigo)],
  }
  if (!grupos.has(grupo)) grupos.set(grupo, [])
  grupos.get(grupo).push(item)
  return item
}
const guardar = (clave, expresion) => `pm.collectionVariables.set('${clave}', ${expresion});`
const iniciar = actor => `asegurar(typeof datos.token === 'string' && datos.token.length > 30, 'Falta JWT de prueba'); asegurar(!('claveHash' in datos.usuario) && !('clave' in datos.usuario), 'Contraseña expuesta'); ${guardar(`${actor}Token`, 'datos.token')}`

const salud = caso('01 Preparación', 'E6-01 Salud de la API temporal', 'GET', '/salud', 200)
salud.event.unshift(evento('prerequest', `
pm.collectionVariables.set('sufijo', Date.now().toString(36));
const hoy = new Date(Date.now() - 5 * 60 * 60 * 1000);
const lunes = new Date(hoy.toISOString().slice(0, 10) + 'T00:00:00Z');
lunes.setUTCDate(lunes.getUTCDate() + 14);
while (lunes.getUTCDay() !== 1) lunes.setUTCDate(lunes.getUTCDate() + 1);
pm.collectionVariables.set('fecha', lunes.toISOString().slice(0, 10));
lunes.setUTCDate(lunes.getUTCDate() + 7);
pm.collectionVariables.set('fechaNueva', lunes.toISOString().slice(0, 10));
for (const clave of ['tutorToken', 'solicitanteToken', 'adminToken', 'ajenoToken', 'perfilId', 'sesionId', 'cancelableId', 'rechazableId', 'materiaCreadaId']) pm.collectionVariables.unset(clave);
`))
caso('01 Preparación', 'E6-02 Swagger publicado', 'GET', '/docs.json', 200, { comprobar: "asegurar(datos.openapi.startsWith('3.'), 'Falta OpenAPI 3'); asegurar(datos.paths['/sesiones'], 'Falta documentación de sesiones');" })
caso('01 Preparación', 'E6-03 Programas públicos', 'GET', '/programas', 200, { comprobar: `asegurar(Array.isArray(datos) && datos.length > 0, 'Faltan programas'); ${guardar('programaId', 'datos[0].id')}` })
caso('01 Preparación', 'E6-04 Materias del programa', 'GET', '/materias?programa={{programaId}}', 200, { comprobar: `asegurar(Array.isArray(datos) && datos.length >= 2, 'La fixture necesita dos materias'); ${guardar('materiaId', 'datos[0].id')} ${guardar('otraMateriaId', 'datos[1].id')}` })
caso('01 Preparación', 'E6-05 Sesiones sin autenticación', 'GET', '/sesiones', 401)
caso('01 Preparación', 'E6-06 Ingreso de coordinación ficticia', 'POST', '/auth/ingreso', 200, { cuerpo: { correoInstitucional: 'gabriela.montes@uniguajira.edu.co', clave: v('clave') }, comprobar: iniciar('admin') })
caso('01 Preparación', 'E6-07 Ingreso de tercero ajeno', 'POST', '/auth/ingreso', 200, { cuerpo: { correoInstitucional: 'bruno.valdes@uniguajira.edu.co', clave: v('clave') }, comprobar: iniciar('ajeno') })

caso('02 Autenticación y perfil', 'E6-08 R8 rechaza dominio externo', 'POST', '/auth/registro', 400, { cuerpo: registro(true, { correoInstitucional: 'qa@example.com' }), comprobar: "asegurar(datos.errores.some(e => e.includes('uniguajira.edu.co')), 'Falta explicación del dominio');" })
caso('02 Autenticación y perfil', 'E6-09 Consentimiento obligatorio', 'POST', '/auth/registro', 400, { cuerpo: registro(true, { aceptaTratamientoDatos: false }) })
caso('02 Autenticación y perfil', 'E6-10 Registro con elección de tutor', 'POST', '/auth/registro', 201, { cuerpo: registro(true), comprobar: `${iniciar('tutor')} asegurar(datos.usuario.quiereSerTutor === true, 'Rol incorrecto'); asegurar(datos.usuario.consentimientoDatos.aceptado === true && datos.usuario.consentimientoDatos.fecha, 'Falta consentimiento fechado');` })
caso('02 Autenticación y perfil', 'E6-11 Correo duplicado', 'POST', '/auth/registro', 409, { cuerpo: registro(true) })
caso('02 Autenticación y perfil', 'E6-12 Registro de solicitante', 'POST', '/auth/registro', 201, { cuerpo: registro(false), comprobar: `${iniciar('solicitante')} asegurar(datos.usuario.quiereSerTutor === false, 'Rol incorrecto');` })
caso('02 Autenticación y perfil', 'E6-13 Cuenta propia desde JWT', 'GET', '/auth/yo', 200, { actor: 'solicitante', comprobar: "asegurar(datos.usuario.correoInstitucional.includes(pm.collectionVariables.get('sufijo')), 'Cuenta incorrecta'); asegurar(!('claveHash' in datos.usuario), 'Hash expuesto');" })
caso('02 Autenticación y perfil', 'E6-14 R9 rechaza franjas solapadas', 'PUT', '/tutores/mi-perfil', 400, { actor: 'tutor', cuerpo: { ...perfil, disponibilidad: [franja, { ...franja, horaInicio: '09:00', horaFin: '11:00' }] }, comprobar: "asegurar(datos.errores.some(e => e.includes('solapa')), 'Falta detalle del solapamiento');" })
caso('02 Autenticación y perfil', 'E6-15 R10 cero no representa gratuidad', 'PUT', '/tutores/mi-perfil', 400, { actor: 'tutor', cuerpo: { ...perfil, tarifaHora: 0 } })
caso('02 Autenticación y perfil', 'E6-16 R10 tarifa negativa inválida', 'PUT', '/tutores/mi-perfil', 400, { actor: 'tutor', cuerpo: { ...perfil, tarifaHora: -100 } })
caso('02 Autenticación y perfil', 'E6-17 Activar perfil gratuito pendiente', 'PUT', '/tutores/mi-perfil', 201, { actor: 'tutor', cuerpo: perfil, comprobar: `${guardar('perfilId', 'datos.id')} asegurar(datos.estadoVerificacion === 'PENDIENTE' && datos.tarifaHora === null, 'Perfil o tarifa incorrectos');` })
caso('02 Autenticación y perfil', 'E6-18 R4 impide pedir a tutor no verificado', 'POST', '/sesiones', 409, { actor: 'solicitante', cuerpo: solicitud(), regla: 'R4' })
caso('02 Autenticación y perfil', 'E6-19 Estudiante no verifica perfiles', 'PATCH', '/coordinacion/perfiles/{{perfilId}}/verificar', 403, { actor: 'solicitante' })
caso('02 Autenticación y perfil', 'E6-20 Coordinación verifica perfil', 'PATCH', '/coordinacion/perfiles/{{perfilId}}/verificar', 200, { actor: 'admin', comprobar: "asegurar(datos.estadoVerificacion === 'VERIFICADO', 'No se verificó');" })
caso('02 Autenticación y perfil', 'E6-21 Búsqueda filtrada sin datos privados', 'GET', '/tutores?materia={{materiaId}}&dia=LUNES&soloGratuitas=true', 200, { actor: 'solicitante', comprobar: "const perfil = datos.find(p => p.id === pm.collectionVariables.get('perfilId')); asegurar(perfil, 'Tutor ausente'); asegurar(!('correoInstitucional' in perfil.estudiante) && !('telefono' in perfil.estudiante) && !('documento' in perfil.estudiante), 'Datos privados expuestos');" })

caso('03 Sesiones y reglas', 'E6-22 R1 impide autorreserva', 'POST', '/sesiones', 409, { actor: 'tutor', cuerpo: solicitud(), regla: 'R1' })
caso('03 Sesiones y reglas', 'E6-23 R2 exige materia ofrecida', 'POST', '/sesiones', 409, { actor: 'solicitante', cuerpo: solicitud({ materia: v('otraMateriaId') }), regla: 'R2' })
caso('03 Sesiones y reglas', 'E6-24 R3 exige franja ofrecida', 'POST', '/sesiones', 409, { actor: 'solicitante', cuerpo: solicitud({ franja: { ...franja, horaInicio: '10:00', horaFin: '12:00' } }), regla: 'R3' })
caso('03 Sesiones y reglas', 'E6-25 Tema insuficiente explica tres palabras', 'POST', '/sesiones', 400, { actor: 'solicitante', cuerpo: solicitud({ tema: 'Programación' }), comprobar: "asegurar(datos.errores.some(e => /3|tres/.test(e)), 'Falta condición de tres palabras');" })
caso('03 Sesiones y reglas', 'E6-26 Solicitud pendiente persistida', 'POST', '/sesiones', 201, { actor: 'solicitante', cuerpo: solicitud(), comprobar: `${guardar('sesionId', 'datos.id')} asegurar(datos.estado === 'PENDIENTE', 'Estado inicial incorrecto'); asegurar(!('correoInstitucional' in datos.tutor.estudiante), 'Contacto expuesto antes de aceptar');` })
caso('03 Sesiones y reglas', 'E6-27 RQNF012 rechaza reserva duplicada', 'POST', '/sesiones', 409, { actor: 'solicitante', cuerpo: solicitud(), regla: 'RQNF012' })
caso('03 Sesiones y reglas', 'E6-28 Ocupación pública sin participantes', 'GET', '/tutores/{{perfilId}}/ocupacion', 200, { actor: 'ajeno', comprobar: "asegurar(datos.length === 1 && datos[0].fecha === pm.collectionVariables.get('fecha'), 'Reserva no visible'); asegurar(Object.keys(datos[0]).sort().join(',') === 'fecha,franja', 'La ocupación expone participantes');" })
caso('03 Sesiones y reglas', 'E6-29 Tercero no consulta sesión', 'GET', '/sesiones/{{sesionId}}', 403, { actor: 'ajeno' })
caso('03 Sesiones y reglas', 'E6-30 Solicitante no confirma su petición', 'PATCH', '/sesiones/{{sesionId}}/confirmar', 403, { actor: 'solicitante' })
caso('03 Sesiones y reglas', 'E6-31 Cancelación exige motivo', 'PATCH', '/sesiones/{{sesionId}}/cancelar', 400, { actor: 'solicitante', cuerpo: {} })
caso('03 Sesiones y reglas', 'E6-32 R6 impide calificar pendiente', 'POST', '/sesiones/{{sesionId}}/calificacion', 409, { actor: 'solicitante', cuerpo: { puntaje: 4 }, regla: 'R6' })
caso('03 Sesiones y reglas', 'E6-33 R7 rechaza puntaje fuera de rango', 'POST', '/sesiones/{{sesionId}}/calificacion', 400, { actor: 'solicitante', cuerpo: { puntaje: 6 } })
caso('03 Sesiones y reglas', 'E6-34 Tutor acepta solicitud', 'PATCH', '/sesiones/{{sesionId}}/confirmar', 200, { actor: 'tutor', comprobar: "asegurar(datos.estado === 'CONFIRMADA', 'Sesión no confirmada');" })
caso('03 Sesiones y reglas', 'E6-35 Contacto limitado a sesión confirmada', 'GET', '/sesiones/{{sesionId}}', 200, { actor: 'solicitante', comprobar: "asegurar(datos.tutor.estudiante.correoInstitucional.includes(pm.collectionVariables.get('sufijo')), 'Contacto ausente');" })
caso('03 Sesiones y reglas', 'E6-36 Propuesta no altera fecha vigente', 'PUT', '/sesiones/{{sesionId}}/reprogramacion', 200, { actor: 'solicitante', cuerpo: { fecha: v('fechaNueva'), franja }, comprobar: "asegurar(datos.fecha === pm.collectionVariables.get('fecha') && datos.reprogramacion, 'Cambio anticipado o propuesta ausente');" })
caso('03 Sesiones y reglas', 'E6-37 Proponente no acepta su propuesta', 'PATCH', '/sesiones/{{sesionId}}/reprogramacion', 403, { actor: 'solicitante', cuerpo: { acepta: true } })
caso('03 Sesiones y reglas', 'E6-38 Contraparte acepta reprogramación', 'PATCH', '/sesiones/{{sesionId}}/reprogramacion', 200, { actor: 'tutor', cuerpo: { acepta: true }, comprobar: "asegurar(datos.fecha === pm.collectionVariables.get('fechaNueva') && datos.reprogramacion === null, 'No se aplicó la propuesta');" })
caso('03 Sesiones y reglas', 'E6-39 Tutor finaliza sesión', 'PATCH', '/sesiones/{{sesionId}}/finalizar', 200, { actor: 'tutor', comprobar: "asegurar(datos.estado === 'FINALIZADA', 'No se finalizó');" })
caso('03 Sesiones y reglas', 'E6-40 R5 impide repetir finalización', 'PATCH', '/sesiones/{{sesionId}}/finalizar', 409, { actor: 'tutor', regla: 'R5' })
caso('03 Sesiones y reglas', 'E6-41 Calificación y reseña persistidas', 'POST', '/sesiones/{{sesionId}}/calificacion', 201, { actor: 'solicitante', cuerpo: { puntaje: 4, resena: 'Explicación con ejemplos claros' }, comprobar: "asegurar(datos.calificacion.puntaje === 4, 'Nota no persistida');" })
caso('03 Sesiones y reglas', 'E6-42 R6 impide segunda calificación', 'POST', '/sesiones/{{sesionId}}/calificacion', 409, { actor: 'solicitante', cuerpo: { puntaje: 5 }, regla: 'R6' })
caso('03 Sesiones y reglas', 'E6-43 Nueva lectura conserva calificación', 'GET', '/sesiones/{{sesionId}}', 200, { actor: 'solicitante', comprobar: "asegurar(datos.calificacion.puntaje === 4, 'Nota alterada por reintento');" })
caso('03 Sesiones y reglas', 'E6-44 Promedio y tutorías derivadas', 'GET', '/tutores/{{perfilId}}', 200, { actor: 'solicitante', comprobar: "asegurar(datos.promedio === 4 && datos.totalCalificaciones === 1 && datos.tutoriasCompletadas === 1, 'Agregados incorrectos'); asegurar(datos.resenas.length === 1 && datos.resenas[0].puntaje === 4, 'Reseña ausente');" })
caso('03 Sesiones y reglas', 'E6-45 Lista propia por estado', 'GET', '/sesiones?estado=FINALIZADA&papel=SOLICITANTE', 200, { actor: 'solicitante', comprobar: "asegurar(datos.length === 1 && datos[0].id === pm.collectionVariables.get('sesionId'), 'Sesión ausente');" })
caso('03 Sesiones y reglas', 'E6-46 Reserva original liberada al reprogramar', 'POST', '/sesiones', 201, { actor: 'solicitante', cuerpo: solicitud(), comprobar: guardar('cancelableId', 'datos.id') })
caso('03 Sesiones y reglas', 'E6-47 Cancelar con motivo persistido', 'PATCH', '/sesiones/{{cancelableId}}/cancelar', 200, { actor: 'solicitante', cuerpo: { motivo: 'Coincide con otra actividad académica' }, comprobar: "asegurar(datos.estado === 'CANCELADA' && datos.motivo.includes('actividad'), 'Cancelación incompleta');" })
caso('03 Sesiones y reglas', 'E6-48 R5 impide confirmar cancelada', 'PATCH', '/sesiones/{{cancelableId}}/confirmar', 409, { actor: 'tutor', regla: 'R5' })
caso('03 Sesiones y reglas', 'E6-49 Cancelación libera la reserva', 'POST', '/sesiones', 201, { actor: 'solicitante', cuerpo: solicitud(), comprobar: guardar('rechazableId', 'datos.id') })
caso('03 Sesiones y reglas', 'E6-50 Tutor rechaza con motivo', 'PATCH', '/sesiones/{{rechazableId}}/rechazar', 200, { actor: 'tutor', cuerpo: { motivo: 'No puedo asistir en esa fecha' }, comprobar: "asegurar(datos.estado === 'RECHAZADA', 'Rechazo no persistido');" })

caso('04 Favoritos y coordinación', 'E6-51 Agregar favorito', 'PUT', '/favoritos/{{perfilId}}', 200, { actor: 'solicitante' })
caso('04 Favoritos y coordinación', 'E6-52 Agregar favorito es idempotente', 'PUT', '/favoritos/{{perfilId}}', 200, { actor: 'solicitante' })
caso('04 Favoritos y coordinación', 'E6-53 Favorito único persistido', 'GET', '/favoritos', 200, { actor: 'solicitante', comprobar: "asegurar(datos.length === 1 && datos[0].id === pm.collectionVariables.get('perfilId'), 'Favorito repetido o ausente');" })
caso('04 Favoritos y coordinación', 'E6-54 Quitar favorito', 'DELETE', '/favoritos/{{perfilId}}', 200, { actor: 'solicitante' })
caso('04 Favoritos y coordinación', 'E6-55 Quitar favorito es idempotente', 'DELETE', '/favoritos/{{perfilId}}', 200, { actor: 'solicitante' })
caso('04 Favoritos y coordinación', 'E6-56 Lista vacía tras quitar favorito', 'GET', '/favoritos', 200, { actor: 'solicitante', comprobar: "asegurar(datos.length === 0, 'No se retiró el favorito');" })
caso('04 Favoritos y coordinación', 'E6-57 Métricas exclusivas de coordinación', 'GET', '/coordinacion/metricas', 403, { actor: 'solicitante' })
caso('04 Favoritos y coordinación', 'E6-58 Coordinación consulta métricas', 'GET', '/coordinacion/metricas', 200, { actor: 'admin', comprobar: "asegurar(datos && typeof datos === 'object', 'Métricas inválidas');" })
caso('04 Favoritos y coordinación', 'E6-59 Estudiante no crea materias', 'POST', '/materias', 403, { actor: 'solicitante', cuerpo: { codigo: 'QA-{{sufijo}}', nombre: 'Materia de pruebas', programa: v('programaId') } })
caso('04 Favoritos y coordinación', 'E6-60 Crear materia con id de servidor', 'POST', '/materias', 201, { actor: 'admin', cuerpo: { codigo: 'QA-{{sufijo}}', nombre: 'Materia de pruebas', programa: v('programaId') }, comprobar: `${guardar('materiaCreadaId', 'datos.id')} asegurar(datos.activa === true, 'Materia nueva inactiva');` })
caso('04 Favoritos y coordinación', 'E6-61 Editar materia persistida', 'PUT', '/materias/{{materiaCreadaId}}', 200, { actor: 'admin', cuerpo: { nombre: 'Materia de integración' }, comprobar: "asegurar(datos.nombre === 'Materia de integración', 'Nombre no actualizado');" })
caso('04 Favoritos y coordinación', 'E6-62 Desactivar materia', 'DELETE', '/materias/{{materiaCreadaId}}', 200, { actor: 'admin' })
caso('04 Favoritos y coordinación', 'E6-63 Conservar materia en historial', 'GET', '/materias/{{materiaCreadaId}}', 200, { comprobar: "asegurar(datos.activa === false && datos.nombre === 'Materia de integración', 'Materia eliminada o edición perdida');" })
caso('04 Favoritos y coordinación', 'E6-64 Catálogo público omite inactivas', 'GET', '/materias', 200, { comprobar: "asegurar(!datos.some(m => m.id === pm.collectionVariables.get('materiaCreadaId')), 'Materia inactiva en catálogo');" })
caso('04 Favoritos y coordinación', 'E6-65 Administrador ve inactivas', 'GET', '/materias?incluirInactivas=true', 200, { actor: 'admin', comprobar: "asegurar(datos.some(m => m.id === pm.collectionVariables.get('materiaCreadaId') && !m.activa), 'Materia inactiva ausente');" })

const coleccion = {
  info: { name: 'ConectaTutor — Pruebas locales E6', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Ejecutar completa y en orden SOLO contra API local aislada con fixture ficticia. node --test pruebas/coleccion.test.js desde backend, incluido en npm test, crea MongoMemoryServer, puerto efímero y cierre automático. No usar una API de desarrollo conectada a Atlas. Los JWT quedan en memoria durante el ejecutor; no exportar valores actuales de Postman. Estas 65 peticiones son secuenciales; la suite añade por separado carreras HTTP de reserva y calificación. No demuestra interfaz, responsive, navegación, caducidad por inactividad, carga productiva ni respaldo. No certifica E5/E6 ni sustituye la matriz de 44 requisitos.' },
  auth: { type: 'noauth' },
  variable: [{ key: 'baseUrl', value: 'http://localhost:3000/api' }, { key: 'clave', value: 'ClaveDePrueba1' }],
  event: [evento('prerequest', String.raw`
const destino = pm.variables.replaceIn(pm.request.url.toString());
if (!/^http:\/\/localhost:\d{1,5}\/api(?:\/|$)/.test(destino)) throw new Error('Esta colección solo permite API HTTP de prueba en localhost con puerto explícito');
`)],
  item: [...grupos].map(([name, item]) => ({ name, item })),
}
await writeFile(new URL('../Coleccion ConectaTutor.json', import.meta.url), `${JSON.stringify(coleccion, null, 2)}\n`)
console.log(`Colección preparada: ${[...grupos.values()].flat().length} peticiones en ${grupos.size} grupos; sin tokens guardados`)
