import assert from 'node:assert/strict'
import { test } from 'node:test'
import Administrador from '../src/modelo/Administrador.js'
import Estudiante from '../src/modelo/Estudiante.js'
import FranjaHoraria from '../src/modelo/FranjaHoraria.js'
import Materia from '../src/modelo/Materia.js'
import PerfilTutor from '../src/modelo/PerfilTutor.js'
import Programa from '../src/modelo/Programa.js'
import Sesion from '../src/modelo/Sesion.js'
import { EstadoSesion, EstadoVerificacion, RolUsuario } from '../src/modelo/enums.js'
import {
  materiaDesdeApi, perfilDesdeApi, programaDesdeApi, reprogramacionDesdeApi, sesionDesdeApi, usuarioDesdeApi,
} from '../src/servicios/mapeoApi.js'

const ids = {
  programa: '6728f1a2b3c4d5e6f7a8b9c0', materia: '6728f1a2b3c4d5e6f7a8b9c1',
  solicitante: '6728f1a2b3c4d5e6f7a8b9c2', tutor: '6728f1a2b3c4d5e6f7a8b9c3',
  perfil: '6728f1a2b3c4d5e6f7a8b9c4', sesion: '6728f1a2b3c4d5e6f7a8b9c5',
}
const dtoPrograma = () => ({ id: ids.programa, nombre: 'Ingeniería de Sistemas', facultad: 'Ingeniería' })
const dtoMateria = () => ({ id: ids.materia, nombre: 'Programación', codigo: 'SIS-01', programa: dtoPrograma() })
const dtoEstudiante = (tutor = false) => ({
  id: tutor ? ids.tutor : ids.solicitante, nombre: tutor ? 'Tutor de prueba' : 'Solicitante de prueba',
  sede: 'Riohacha', semestre: tutor ? 6 : 2, programa: dtoPrograma(),
})
const dtoPerfil = () => ({
  id: ids.perfil, estudiante: dtoEstudiante(true), biografia: 'Tutor con experiencia en programación',
  tarifaHora: 10000, estadoVerificacion: EstadoVerificacion.VERIFICADO,
  materias: [dtoMateria()], disponibilidad: [{ dia: 'LUNES', horaInicio: '10:00', horaFin: '12:00' }],
})
const dtoSesion = () => ({
  id: ids.sesion, solicitante: dtoEstudiante(),
  tutor: { id: ids.perfil, estudiante: dtoEstudiante(true), tarifaHora: 10000 },
  materia: { id: ids.materia, codigo: 'SIS-01', nombre: 'Programación' },
  fecha: '2026-12-07', franja: { dia: 'LUNES', horaInicio: '10:00', horaFin: '12:00' },
  tema: 'Repasar ciclos y arreglos', estado: EstadoSesion.PENDIENTE, motivo: null, calificacion: null,
})

function catalogo() {
  const programa = programaDesdeApi(dtoPrograma())
  const materia = materiaDesdeApi(dtoMateria(), { programas: [programa] })
  return { programa, materia, programas: [programa], materias: [materia] }
}

test('reconstruye programa y materia con sus identificadores y clases', () => {
  const { programa, materia } = catalogo()
  assert.ok(programa instanceof Programa)
  assert.ok(materia instanceof Materia)
  assert.deepEqual(programa.toJSON(), dtoPrograma())
  assert.equal(materia.getId(), ids.materia)
  assert.equal(materia.getNombre(), 'Programación')
  assert.equal(materia.getPrograma(), programa)
})

test('resuelve un programa por id solo cuando existe en el catálogo', () => {
  const { programa, programas } = catalogo()
  assert.equal(materiaDesdeApi({ ...dtoMateria(), programa: ids.programa }, { programas }).getPrograma(), programa)
  assert.throws(() => materiaDesdeApi({ ...dtoMateria(), programa: ids.programa }), /carga el catálogo de programas/)
})

test('reconstruye estudiante público con correo vacío y sin inventar perfil resumido', () => {
  const { programa, programas } = catalogo()
  const usuario = usuarioDesdeApi({ ...dtoEstudiante(), perfilTutor: { id: ids.perfil, estadoVerificacion: 'VERIFICADO' } }, { programas })
  assert.ok(usuario instanceof Estudiante)
  assert.equal(usuario.getRol(), RolUsuario.ESTUDIANTE)
  assert.equal(usuario.getId(), ids.solicitante)
  assert.equal(usuario.getCorreo(), '')
  assert.equal(usuario.getPrograma(), programa)
  assert.equal(usuario.getPerfilTutor(), null)
})

test('conserva el correo propio entregado y descarta campos ajenos al modelo', () => {
  const usuario = usuarioDesdeApi({ ...dtoEstudiante(), tipo: 'ESTUDIANTE', correoInstitucional: 'prueba@ejemplo.test', claveHash: 'no-copiar', token: 'no-copiar' })
  assert.equal(usuario.getCorreo(), 'prueba@ejemplo.test')
  assert.equal(usuario.toJSON().claveHash, undefined)
  assert.equal(usuario.toJSON().token, undefined)
})

test('reconstruye administrador sin necesitar un programa académico', () => {
  const usuario = usuarioDesdeApi({ id: ids.tutor, tipo: 'ADMINISTRADOR', nombre: 'Coordinación de prueba', dependencia: 'Permanencia', correoInstitucional: 'admin@ejemplo.test' })
  assert.ok(usuario instanceof Administrador)
  assert.equal(usuario.getRol(), RolUsuario.ADMINISTRADOR)
  assert.equal(usuario.getId(), ids.tutor)
  assert.equal(usuario.getDependencia(), 'Permanencia')
})

test('el perfil conserva composición, referencias de catálogo, verificación, tarifa y franjas', () => {
  const opciones = catalogo()
  const perfil = perfilDesdeApi(dtoPerfil(), opciones)
  assert.ok(perfil instanceof PerfilTutor)
  assert.equal(perfil.getId(), ids.perfil)
  assert.equal(perfil.getEstudiante().getId(), ids.tutor)
  assert.equal(perfil.getEstudiante().getPerfilTutor(), perfil)
  assert.equal(perfil.getEstudiante().getPrograma(), opciones.programa)
  assert.equal(perfil.getMaterias()[0], opciones.materia)
  assert.equal(perfil.getEstadoVerificacion(), 'VERIFICADO')
  assert.equal(perfil.getTarifaHora(), 10000)
  assert.deepEqual(perfil.getDisponibilidad()[0].toJSON(), dtoPerfil().disponibilidad[0])
})

test('una llamada sin catálogo comparte el programa entre dueño y materias del perfil', () => {
  const perfil = perfilDesdeApi(dtoPerfil())
  assert.equal(perfil.getEstudiante().getPrograma(), perfil.getMaterias()[0].getPrograma())
})

test('un perfil rechazado conserva su motivo y una tarifa gratuita conserva null', () => {
  const perfil = perfilDesdeApi({ ...dtoPerfil(), estadoVerificacion: 'RECHAZADO', motivoRechazo: 'Falta el soporte académico', tarifaHora: null })
  assert.equal(perfil.getEstadoVerificacion(), 'RECHAZADO')
  assert.equal(perfil.getMotivoRechazo(), 'Falta el soporte académico')
  assert.equal(perfil.getTarifaHora(), null)
})

test('reconstruye sesión con hora de Bogotá, referencias y tutor mínimo sin inventar oferta', () => {
  const opciones = catalogo()
  const sesion = sesionDesdeApi(dtoSesion(), opciones)
  assert.ok(sesion instanceof Sesion)
  assert.equal(sesion.getId(), ids.sesion)
  assert.equal(sesion.getFecha().toISOString(), '2026-12-07T15:00:00.000Z')
  assert.equal(sesion.getMateria(), opciones.materia)
  assert.equal(sesion.getSolicitante().getPrograma(), opciones.programa)
  assert.equal(sesion.getTutor().getEstudiante().getPrograma(), opciones.programa)
  assert.equal(sesion.getTutor().getEstudiante().getPerfilTutor(), sesion.getTutor())
  assert.equal(sesion.getTutor().getEstadoVerificacion(), 'PENDIENTE')
  assert.equal(sesion.getTutor().getTarifaHora(), 10000)
  assert.deepEqual(sesion.getTutor().getMaterias(), [])
  assert.deepEqual(sesion.getTutor().getDisponibilidad(), [])
  assert.equal(sesion.getSolicitante().getCorreo(), '')
  assert.equal(sesion.getTutor().getEstudiante().getCorreo(), '')
})

test('sin catálogo no fabrica el programa de una materia resumida en la sesión', () => {
  assert.throws(() => sesionDesdeApi(dtoSesion()), /identificador de programa/)
})

test('conserva estado y motivo de una sesión cancelada', () => {
  const sesion = sesionDesdeApi({ ...dtoSesion(), estado: 'CANCELADA', motivo: 'No puedo asistir ese día' }, catalogo())
  assert.equal(sesion.getEstado(), 'CANCELADA')
  assert.equal(sesion.getMotivo(), 'No puedo asistir ese día')
})

test('la calificación embebida conserva puntaje, reseña, fecha e id local estable', () => {
  const datos = { ...dtoSesion(), estado: 'FINALIZADA', calificacion: { puntaje: 4, resena: 'Explicación clara', fecha: '2026-12-07T19:30:00.000Z' } }
  const primera = sesionDesdeApi(datos, catalogo()).getCalificacion()
  const segunda = sesionDesdeApi(datos, catalogo()).getCalificacion()
  assert.equal(primera.getPuntaje(), 4)
  assert.equal(primera.getResena(), 'Explicación clara')
  assert.equal(primera.getFecha().toISOString(), '2026-12-07T19:30:00.000Z')
  assert.equal(primera.getId(), `${ids.sesion}:calificacion`)
  assert.equal(primera.getId(), segunda.getId())
})

test('si la API entrega id de calificación, lo conserva', () => {
  const datos = { ...dtoSesion(), estado: 'FINALIZADA', calificacion: { id: 'nota-entregada', puntaje: 5, fecha: '2026-12-07T19:30:00.000Z' } }
  assert.equal(sesionDesdeApi(datos, catalogo()).getCalificacion().getId(), 'nota-entregada')
})

test('rechaza una calificación inválida o asociada a un estado no finalizado', () => {
  const nota = { puntaje: 6, fecha: '2026-12-07T19:30:00.000Z' }
  assert.throws(() => sesionDesdeApi({ ...dtoSesion(), estado: 'FINALIZADA', calificacion: nota }, catalogo()), /entre 1 y 5/)
  assert.throws(() => sesionDesdeApi({ ...dtoSesion(), calificacion: { ...nota, puntaje: 4 } }, catalogo()), /Solo una sesión finalizada/)
})

test('reconstruir una sesión desde un perfil existente no cambia ni comparte sus contactos', () => {
  const opciones = catalogo()
  const perfil = perfilDesdeApi({ ...dtoPerfil(), estudiante: { ...dtoEstudiante(true), correoInstitucional: 'privado@ejemplo.test' } }, opciones)
  const original = perfil.toJSON()
  const sesion = sesionDesdeApi(dtoSesion(), { ...opciones, perfiles: [perfil] })
  assert.notEqual(sesion.getTutor(), perfil)
  assert.notEqual(sesion.getTutor().getEstudiante(), perfil.getEstudiante())
  assert.equal(sesion.getTutor().getEstudiante().getCorreo(), '')
  assert.equal(perfil.getEstudiante().getCorreo(), 'privado@ejemplo.test')
  assert.deepEqual(perfil.toJSON(), original)
  assert.equal(sesion.getTutor().getEstadoVerificacion(), 'VERIFICADO')
  assert.equal(sesion.getTutor().getMaterias()[0], opciones.materia)
})

test('dos respuestas de sesión no comparten contacto aunque usen el mismo perfil', () => {
  const opciones = catalogo()
  const perfil = perfilDesdeApi(dtoPerfil(), opciones)
  const confirmada = dtoSesion()
  confirmada.estado = 'CONFIRMADA'
  confirmada.tutor.estudiante.correoInstitucional = 'tutor@ejemplo.test'
  confirmada.solicitante.correoInstitucional = 'solicitante@ejemplo.test'
  const privada = sesionDesdeApi(confirmada, { ...opciones, perfiles: [perfil] })
  const pendiente = sesionDesdeApi(dtoSesion(), { ...opciones, perfiles: [perfil] })
  assert.equal(privada.getTutor().getEstudiante().getCorreo(), 'tutor@ejemplo.test')
  assert.equal(privada.getSolicitante().getCorreo(), 'solicitante@ejemplo.test')
  assert.equal(pendiente.getTutor().getEstudiante().getCorreo(), '')
  assert.equal(pendiente.getSolicitante().getCorreo(), '')
  assert.equal(perfil.getEstudiante().getCorreo(), '')
})

test('un catálogo de perfiles no puede sustituir al dueño real de la sesión', () => {
  const opciones = catalogo()
  const perfil = perfilDesdeApi({ ...dtoPerfil(), estudiante: dtoEstudiante() }, opciones)
  assert.throws(() => sesionDesdeApi(dtoSesion(), { ...opciones, perfiles: [perfil] }), /no coincide/)
})

test('una hora nocturna se conserva en el día colombiano aunque cambie el día UTC', () => {
  const datos = { ...dtoSesion(), franja: { dia: 'LUNES', horaInicio: '23:00', horaFin: '23:59' } }
  assert.equal(sesionDesdeApi(datos, catalogo()).getFecha().toISOString(), '2026-12-08T04:00:00.000Z')
})

test('rechaza una fecha inexistente o fuera del formato de API', () => {
  for (const fecha of ['2026-02-30', '2026-13-01', '07/12/2026', null]) {
    assert.throws(() => sesionDesdeApi({ ...dtoSesion(), fecha }, catalogo()), /fecha de la API/)
  }
})

test('los metadatos de reprogramación se reconstruyen aparte sin cambiar la sesión', () => {
  const datos = {
    propuestaPor: ids.solicitante, esMia: false, fecha: '2026-12-14',
    franja: { dia: 'LUNES', horaInicio: '11:00', horaFin: '13:00' },
    motivo: 'Tengo un parcial', propuestaEl: '2026-12-01T12:00:00.000Z',
  }
  const propuesta = reprogramacionDesdeApi(datos)
  assert.ok(propuesta.franja instanceof FranjaHoraria)
  assert.equal(propuesta.fecha.toISOString(), '2026-12-14T16:00:00.000Z')
  assert.equal(propuesta.propuestaEl.toISOString(), datos.propuestaEl)
  assert.equal(propuesta.propuestaPor, ids.solicitante)
  assert.equal(propuesta.esMia, false)
  assert.equal(propuesta.motivo, datos.motivo)
  assert.equal(reprogramacionDesdeApi(null), null)
  const sesion = sesionDesdeApi({ ...dtoSesion(), reprogramacion: datos }, catalogo())
  assert.equal(sesion.getFecha().toISOString(), '2026-12-07T15:00:00.000Z')
})

test('rechaza datos insuficientes sin generar usuarios, programas ni identificadores ficticios', () => {
  assert.throws(() => programaDesdeApi({ nombre: 'Sin identificador', facultad: 'Prueba' }), /identificador de programa/)
  assert.throws(() => programaDesdeApi({ id: ids.programa, nombre: 'Sin facultad' }), /facultad/)
  assert.throws(() => usuarioDesdeApi(null), /datos de usuario/)
  assert.throws(() => usuarioDesdeApi({ ...dtoEstudiante(), tipo: 'OTRO' }), /tipo de usuario/)
  assert.throws(() => usuarioDesdeApi({ ...dtoEstudiante(), programa: null }), /identificador de programa/)
  assert.throws(() => usuarioDesdeApi({ ...dtoEstudiante(), semestre: undefined }), /tipo de usuario|semestre/)
  assert.throws(() => perfilDesdeApi({ ...dtoPerfil(), estudiante: null }), /datos de usuario/)
  assert.throws(() => perfilDesdeApi({ ...dtoPerfil(), tarifaHora: undefined }), /tarifa/)
  assert.throws(() => perfilDesdeApi({ ...dtoPerfil(), materias: undefined }), /lista de materias/)
  assert.throws(() => sesionDesdeApi({ ...dtoSesion(), solicitante: null }, catalogo()), /datos de usuario/)
})

test('el mapeo no modifica los DTO ni los arreglos de catálogo recibidos', () => {
  const opciones = catalogo()
  const datos = dtoSesion()
  const original = structuredClone(datos)
  Object.freeze(opciones.programas)
  Object.freeze(opciones.materias)
  Object.freeze(datos.tutor.estudiante)
  Object.freeze(datos.solicitante)
  sesionDesdeApi(datos, opciones)
  assert.deepEqual(datos, original)
  assert.equal(opciones.programas.length, 1)
  assert.equal(opciones.materias.length, 1)
})
