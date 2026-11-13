import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, beforeEach, describe, it } from 'node:test'
import { crearClienteApi } from '../../frontend/src/servicios/api.js'
import { crearRepositorioApi } from '../../frontend/src/servicios/repositorioApi.js'
import ServicioAutenticacionApi from '../../frontend/src/servicios/ServicioAutenticacionApi.js'
import Estudiante from '../../frontend/src/modelo/Estudiante.js'
import Administrador from '../../frontend/src/modelo/Administrador.js'
import Materia from '../../frontend/src/modelo/Materia.js'
import FranjaHoraria from '../../frontend/src/modelo/FranjaHoraria.js'
import { app } from '../src/app.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { hoyEnColombia } from '../src/utils/fechas.js'
import { CORREOS } from './ayudas/sesion.js'

function crearAlmacen() {
  const valores = new Map([['otra.aplicacion', 'conservar']])
  return {
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => valores.set(clave, String(valor)),
    removeItem: (clave) => valores.delete(clave),
    claves: () => [...valores.keys()],
  }
}

function lunes(n) {
  const dia = new Date(`${hoyEnColombia()}T00:00:00Z`)
  while (n > 0) {
    dia.setUTCDate(dia.getUTCDate() + 1)
    if (dia.getUTCDay() === 1) n -= 1
  }
  return dia.toISOString().slice(0, 10)
}

describe('Preparación E5/E6 · Repositorio de dominio sobre la API temporal', () => {
  let servidor, urlBase, tutor, solicitante, coordinacion
  const preparar = (almacen = crearAlmacen()) => {
    const cliente = crearClienteApi({ urlBase, almacen })
    const repositorio = crearRepositorioApi({ cliente })
    const autenticacion = new ServicioAutenticacionApi(repositorio, 'uniguajira.edu.co')
    return { cliente, repositorio, autenticacion, almacen }
  }
  before(async () => {
    await iniciarBaseDePrueba()
    servidor = app.listen(0, 'localhost')
    await once(servidor, 'listening')
    urlBase = `http://localhost:${servidor.address().port}/api`
  })
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    reiniciarIntentos()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    tutor = preparar()
    solicitante = preparar()
    coordinacion = preparar()
    tutor.usuario = await tutor.autenticacion.iniciarSesion(CORREOS.bruno, CLAVE_DE_PRUEBA)
    solicitante.usuario = await solicitante.autenticacion.iniciarSesion(CORREOS.elena, CLAVE_DE_PRUEBA)
    coordinacion.usuario = await coordinacion.autenticacion.iniciarSesion(CORREOS.administrador, CLAVE_DE_PRUEBA)
  })
  after(async () => {
    if (servidor) await new Promise((resolver) => { servidor.close(resolver); servidor.closeAllConnections() })
    await detenerBaseDePrueba()
  })

  async function solicitar({ repositorio = solicitante.repositorio, perfil } = {}) {
    perfil ??= await solicitante.repositorio.obtenerPerfilTutor(tutor.usuario.getPerfilTutor().getId())
    const franja = perfil.getDisponibilidad().find((horario) => horario.getDia() === 'LUNES')
    const sesion = solicitante.usuario.solicitarSesion(perfil, perfil.getMaterias()[0], franja, `${lunes(4)}T${franja.getHoraInicio()}:00-05:00`, 'Resolver el taller de planeación')
    return repositorio.guardarSesion(sesion)
  }

  it('restaura clases, composición y sesión; solo persiste el token', async () => {
    assert.ok(tutor.usuario instanceof Estudiante)
    assert.ok(coordinacion.usuario instanceof Administrador)
    assert.ok(tutor.usuario.esTutor())
    assert.equal(tutor.usuario.getPerfilTutor().getEstudiante(), tutor.usuario)
    assert.equal(tutor.usuario.getCorreo(), CORREOS.bruno)
    const restaurado = preparar(tutor.almacen)
    const cuenta = await restaurado.repositorio.obtenerSesionActual()
    assert.equal(cuenta.getId(), tutor.usuario.getId())
    assert.equal(cuenta.getPerfilTutor().getId(), tutor.usuario.getPerfilTutor().getId())
    assert.deepEqual(tutor.almacen.claves().sort(), ['ct.token', 'otra.aplicacion'])
    restaurado.autenticacion.cerrarSesion()
    assert.equal(await restaurado.repositorio.obtenerSesionActual(), null)
    assert.equal(tutor.almacen.getItem('otra.aplicacion'), 'conservar')
    assert.equal(await restaurado.repositorio.asegurarVersion(), false)
    assert.equal(await restaurado.repositorio.cargarDatosIniciales(), false)
  })

  it('registra consentimiento y elección de tutor sin hash ni colecciones locales', async () => {
    const nueva = preparar()
    const programa = (await nueva.repositorio.listarProgramas()).find((fila) => fila.getNombre() === 'Ingeniería de Sistemas')
    const datos = { nombre: 'Aurora Pinto', correoInstitucional: 'aurora.pinto@uniguajira.edu.co', clave: CLAVE_DE_PRUEBA, semestre: 5, sede: 'Riohacha', programa, quiereSerTutor: true }
    await assert.rejects(nueva.autenticacion.registrar(datos), { status: 400 })
    assert.equal(nueva.repositorio.tieneSesionGuardada(), false)
    const cuenta = await nueva.autenticacion.registrar({ ...datos, aceptaTratamientoDatos: true })
    assert.ok(cuenta instanceof Estudiante)
    const dto = (await nueva.cliente.peticion('/auth/yo')).usuario
    assert.equal(dto.quiereSerTutor, true)
    assert.equal(dto.consentimientoDatos.aceptado, true)
    assert.ok(!('claveHash' in dto))
    assert.deepEqual(nueva.almacen.claves().sort(), ['ct.token', 'otra.aplicacion'])
    assert.throws(() => nueva.autenticacion.iniciarSesion('alguien@gmail.com', CLAVE_DE_PRUEBA), (error) => error.getCodigo() === 'R8')
  })

  // E5 M1 y M2: tras una mutación confirmada, un fallo solo de la consulta del catálogo no la presenta como fallida
  function conCorteTrasMutacion(almacen) {
    let pendiente = false
    const fetchImpl = async (url, opciones = {}) => {
      if (pendiente && url.includes('/materias')) { pendiente = false; throw new TypeError('fetch failed') }
      const respuesta = await fetch(url, opciones)
      if ((opciones.method ?? 'GET') !== 'GET' && respuesta.ok) pendiente = true
      return respuesta
    }
    return crearRepositorioApi({ cliente: crearClienteApi({ urlBase, almacen, fetchImpl }) })
  }

  it('E5 M1/M2: crear, aceptar, finalizar y calificar se reconocen aunque falle la consulta posterior', async () => {
    const repoSolicitante = conCorteTrasMutacion(solicitante.almacen)
    const repoTutor = conCorteTrasMutacion(tutor.almacen)
    const perfil = await repoSolicitante.obtenerPerfilTutor(tutor.usuario.getPerfilTutor().getId())
    const borrador = await solicitar({ repositorio: repoSolicitante, perfil })
    assert.equal(borrador.getEstado(), 'PENDIENTE')
    const enApi = await solicitante.repositorio.obtenerSesion(borrador.getId())
    assert.equal(enApi.getEstado(), 'PENDIENTE')

    const deTutor = await repoTutor.obtenerSesion(borrador.getId())
    deTutor.confirmar()
    assert.equal((await repoTutor.guardarSesion(deTutor)).getEstado(), 'CONFIRMADA')
    const confirmada = await repoTutor.obtenerSesion(borrador.getId())
    confirmada.finalizar()
    assert.equal((await repoTutor.guardarSesion(confirmada)).getEstado(), 'FINALIZADA')

    const terminada = await repoSolicitante.obtenerSesion(borrador.getId())
    terminada.calificar(4, 'Muy claro')
    assert.equal((await repoSolicitante.guardarSesion(terminada)).getCalificacion().getPuntaje(), 4)
    const releida = await solicitante.repositorio.obtenerSesion(borrador.getId())
    assert.throws(() => releida.calificar(5, ''), (error) => error.getCodigo() === 'R6')
  })

  it('E5 M2: cancelar se reconoce aunque falle la consulta posterior; un corte antes del guardado no cambia nada', async () => {
    const sesion = await solicitar()
    const sinRed = crearRepositorioApi({ cliente: crearClienteApi({ urlBase, almacen: solicitante.almacen, fetchImpl: async (url, opciones = {}) => {
      if ((opciones.method ?? 'GET') !== 'GET') throw new TypeError('fetch failed')
      return fetch(url, opciones)
    } }) })
    const intento = await sinRed.obtenerSesion(sesion.getId())
    intento.cancelar('Ya no necesito la tutoría')
    await assert.rejects(sinRed.guardarSesion(intento))
    assert.equal((await solicitante.repositorio.obtenerSesion(sesion.getId())).getEstado(), 'PENDIENTE')

    const repo = conCorteTrasMutacion(solicitante.almacen)
    const actual = await repo.obtenerSesion(sesion.getId())
    actual.cancelar('Ya no necesito la tutoría')
    assert.equal((await repo.guardarSesion(actual)).getEstado(), 'CANCELADA')
    assert.equal((await solicitante.repositorio.obtenerSesion(sesion.getId())).getEstado(), 'CANCELADA')
  })

  it('E5 M4: guardar la disponibilidad devuelve la cuenta completa y repetir el clic no revierte lo guardado', async () => {
    const franja = new FranjaHoraria({ dia: 'MARTES', horaInicio: '06:00', horaFin: '07:00' })
    // Misma regla que el botón de MiPerfil: se aplica lo que mostraba la pantalla, no lo contrario de lo guardado
    const aplicar = (perfil, activa) => {
      if (activa && perfil.estaDisponible(franja)) perfil.quitarFranja(franja)
      if (!activa && !perfil.estaDisponible(franja)) perfil.agregarFranja(franja)
      return perfil
    }
    const perfilId = tutor.usuario.getPerfilTutor().getId()
    const inicial = await tutor.repositorio.obtenerPerfilTutor(perfilId)
    assert.equal(inicial.estaDisponible(franja), false)
    const guardado = await tutor.repositorio.guardarPerfilTutor(aplicar(inicial, false))
    const cuenta = guardado.getEstudiante()
    assert.equal(cuenta.getCorreo(), CORREOS.bruno)
    assert.equal(cuenta.getPerfilTutor(), guardado)
    assert.equal(cuenta.getPerfilTutor().estaDisponible(franja), true)
    // Si la lectura posterior falló, la pantalla seguía mostrando el botón inactivo y el usuario repite el clic
    const repetido = await tutor.repositorio.obtenerPerfilTutor(perfilId)
    await tutor.repositorio.guardarPerfilTutor(aplicar(repetido, false))
    assert.equal((await tutor.repositorio.obtenerPerfilTutor(perfilId)).estaDisponible(franja), true)
  })

  it('busca, solicita, acepta, finaliza y califica utilizando métodos de las clases', async () => {
    const sesion = await solicitar()
    assert.equal(sesion.getFecha().toISOString(), `${lunes(4)}T15:00:00.000Z`)
    assert.equal(sesion.getTutor().getEstudiante().getCorreo(), '')
    const deTutor = (await tutor.repositorio.listarSesionesDelTutor(tutor.usuario.getPerfilTutor().getId())).find((fila) => fila.getId() === sesion.getId())
    deTutor.confirmar()
    const confirmada = await tutor.repositorio.guardarSesion(deTutor)
    assert.equal(confirmada.getSolicitante().getCorreo(), CORREOS.elena)
    confirmada.finalizar()
    await tutor.repositorio.guardarSesion(confirmada)
    const terminada = await solicitante.repositorio.obtenerSesion(sesion.getId())
    terminada.calificar(4, 'Explicó con paciencia')
    const calificada = await solicitante.repositorio.guardarSesion(terminada)
    assert.equal(calificada.getCalificacion().getPuntaje(), 4)
    const resumen = await solicitante.repositorio.obtenerResumenTutor(tutor.usuario.getPerfilTutor().getId())
    assert.equal(resumen.promedio, 4)
    assert.equal(resumen.totalCalificaciones, 1)
    assert.equal(resumen.tutoriasCompletadas, 2)
    assert.equal(resumen.resenas[0].resena, 'Explicó con paciencia')
    assert.equal(resumen.perfil.getEstudiante().getCorreo(), '')
    assert.ok(!('sesiones' in resumen))
    const buscados = await solicitante.repositorio.listarTutoresVerificados({ materiaId: sesion.getMateria().getId(), soloGratuitas: true, calificacionMinima: 4 })
    assert.deepEqual(buscados.map((perfil) => perfil.getId()), [resumen.perfil.getId()])
  })

  it('reprograma por contraparte, rechaza duplicación y libera la ocupación anterior', async () => {
    const sesion = await solicitar()
    const id = sesion.getId()
    const perfilId = sesion.getTutor().getId()
    const franja = sesion.getFranja()
    await solicitante.repositorio.proponerReprogramacion(id, { fecha: lunes(5), franja, motivo: 'Tengo un parcial' })
    const propuesta = await solicitante.repositorio.obtenerReprogramacion(id)
    assert.equal(propuesta.esMia, true)
    assert.equal(propuesta.fecha.toISOString(), `${lunes(5)}T15:00:00.000Z`)
    assert.equal(propuesta.franja.getHoraInicio(), '10:00')
    await assert.rejects(solicitante.repositorio.responderReprogramacion(id, true), { status: 403 })
    const cambiada = await tutor.repositorio.responderReprogramacion(id, true)
    assert.equal(cambiada.getFecha().toISOString(), `${lunes(5)}T15:00:00.000Z`)
    const ocupacion = await solicitante.repositorio.obtenerOcupacionTutor(perfilId)
    assert.ok(!ocupacion.some((fila) => fila.fecha === lunes(4)))
    assert.ok(ocupacion.some((fila) => fila.fecha === lunes(5)))
    assert.ok(await solicitar())
    await assert.rejects(solicitar(), { status: 409, regla: 'RQNF012' })
  })

  it('recorre crear, editar y desactivar materia; mantiene legibles las sesiones históricas', async () => {
    const sesion = await solicitar()
    const programa = (await coordinacion.repositorio.listarProgramas())[0]
    const nueva = await coordinacion.repositorio.guardarMateria(new Materia({ codigo: 'PRB-01', nombre: 'Materia de prueba', programa }))
    assert.match(nueva.getId(), /^[a-f\d]{24}$/i)
    const editada = Materia.desdeJSON({ ...nueva.toJSON(), nombre: 'Taller de prueba' }, { buscarPrograma: () => programa })
    assert.equal((await coordinacion.repositorio.guardarMateria(editada)).getNombre(), 'Taller de prueba')
    await assert.rejects(solicitante.repositorio.guardarMateria(editada), { status: 403 })
    await coordinacion.repositorio.desactivarMateria(nueva.getId())
    assert.ok(!(await solicitante.repositorio.listarMaterias()).some((materia) => materia.getId() === nueva.getId()))
    assert.ok((await coordinacion.repositorio.listarMaterias(undefined, { incluirInactivas: true })).some((materia) => materia.getId() === nueva.getId()))
    await coordinacion.repositorio.desactivarMateria(sesion.getMateria().getId())
    const historica = await solicitante.repositorio.obtenerSesion(sesion.getId())
    assert.equal(historica.getMateria().getId(), sesion.getMateria().getId())
    assert.equal(historica.getMateria().getPrograma().getId(), sesion.getMateria().getPrograma().getId())
  })

  it('guarda favoritos y exige cuenta/perfil propios; un 403 conserva sesión', async () => {
    const perfilId = tutor.usuario.getPerfilTutor().getId()
    const usuarioId = solicitante.usuario.getId()
    assert.deepEqual(await solicitante.repositorio.alternarFavorito(usuarioId, perfilId), [perfilId])
    assert.deepEqual(await solicitante.repositorio.listarFavoritos(usuarioId), [perfilId])
    assert.deepEqual(await solicitante.repositorio.alternarFavorito(usuarioId, perfilId), [])
    await solicitante.repositorio.alternarFavorito(usuarioId, perfilId)
    assert.deepEqual(await solicitante.repositorio.quitarFavorito(usuarioId, perfilId), [])
    assert.deepEqual(await solicitante.repositorio.quitarFavorito(usuarioId, perfilId), [])
    await assert.rejects(solicitante.repositorio.obtenerUsuario(tutor.usuario.getId()), { status: 403 })
    await assert.rejects(solicitante.repositorio.listarSesionesDe(tutor.usuario.getId()), { status: 403 })
    await assert.rejects(solicitante.repositorio.listarSesionesDelTutor(perfilId), { status: 403 })
    await assert.rejects(solicitante.repositorio.guardarPerfilTutor(tutor.usuario.getPerfilTutor()), { status: 403 })
    assert.ok(solicitante.repositorio.tieneSesionGuardada())
    assert.equal((await solicitante.repositorio.obtenerSesionActual()).getId(), usuarioId)
  })

  it('guarda edición del perfil propio y verifica/rechaza con coordinación', async () => {
    const diego = preparar()
    const usuario = await diego.autenticacion.iniciarSesion(CORREOS.diego, CLAVE_DE_PRUEBA)
    const perfil = usuario.getPerfilTutor()
    perfil.cambiarBiografia('Explico psicología con ejemplos y ejercicios de clase')
    const guardado = await diego.repositorio.guardarPerfilTutor(perfil)
    assert.equal(guardado.getBiografia(), perfil.getBiografia())
    const pendiente = (await coordinacion.repositorio.listarPerfilesPendientes()).find((fila) => fila.getId() === perfil.getId())
    coordinacion.usuario.verificarTutor(pendiente)
    assert.equal((await coordinacion.repositorio.guardarPerfilTutor(pendiente)).getEstadoVerificacion(), 'VERIFICADO')
    pendiente.marcarRechazado('Falta validar el soporte')
    assert.equal((await coordinacion.repositorio.guardarPerfilTutor(pendiente)).getMotivoRechazo(), 'Falta validar el soporte')
    assert.equal((await coordinacion.repositorio.listarPerfilesTutor()).length, 4)
    assert.ok((await coordinacion.repositorio.obtenerMetricas()).total)
    const nombre = solicitante.usuario.toJSON()
    const programa = solicitante.usuario.getPrograma()
    const editado = Estudiante.desdeJSON({ ...nombre, nombre: 'Elena Lozano Pimienta' }, { buscarPrograma: () => programa })
    assert.equal((await solicitante.repositorio.guardarUsuario(editado)).getNombre(), 'Elena Lozano Pimienta')
  })

  it('una credencial inválida expira sin restaurar datos de demostración', async () => {
    solicitante.cliente.guardarToken('token-invalido-de-prueba')
    assert.equal(await solicitante.repositorio.obtenerSesionActual(), null)
    assert.equal(solicitante.repositorio.tieneSesionGuardada(), false)
    assert.deepEqual(solicitante.almacen.claves(), ['otra.aplicacion'])
    await assert.rejects(solicitante.repositorio.obtenerSesion('id-invalido'), TypeError)
    await solicitante.autenticacion.iniciarSesion(CORREOS.elena, CLAVE_DE_PRUEBA)
    assert.equal(await solicitante.repositorio.obtenerSesion('6728f1a2b3c4d5e6f7a8b9c0'), null)
  })
})
