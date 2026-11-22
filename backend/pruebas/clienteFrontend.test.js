import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, beforeEach, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import { crearClienteApi, ErrorApi, vencimientoDelToken } from '../../frontend/src/servicios/api.js'
import { app } from '../src/app.js'
import { aSegundos, env } from '../src/config/env.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { hoyEnColombia } from '../src/utils/fechas.js'
import { CORREOS, moverAlPasado } from './ayudas/sesion.js'

function almacenEnMemoria() {
  const valores = new Map()
  return {
    getItem: (clave) => valores.get(clave) ?? null,
    setItem: (clave, valor) => valores.set(clave, valor),
    removeItem: (clave) => valores.delete(clave),
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

async function cerrarServidor(servidor) {
  if (!servidor) return
  await new Promise((resolver, rechazar) => {
    servidor.close((error) => error ? rechazar(error) : resolver())
    servidor.closeAllConnections()
  })
}

describe('Preparación E5/E6 · Cliente frontend con HTTP y MongoDB temporales', () => {
  let servidor, urlBase
  const cliente = (opciones = {}) => crearClienteApi({ urlBase, almacen: almacenEnMemoria(), ...opciones })

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
  })
  after(async () => {
    await cerrarServidor(servidor)
    await detenerBaseDePrueba()
  })

  async function ingresar(api, correoInstitucional) {
    const ingreso = await api.peticion('/auth/ingreso', { metodo: 'POST', datos: { correoInstitucional, clave: CLAVE_DE_PRUEBA } })
    api.guardarToken(ingreso.token)
    return ingreso.usuario
  }

  it('recorre el ciclo con dos usuarios y coordinación, incluida reprogramación y calificación', async () => {
    const tutor = cliente(), solicitante = cliente(), coordinacion = cliente()
    const programas = await solicitante.peticion('/programas', { autenticada: false })
    const programa = programas.find((fila) => fila.nombre === 'Ingeniería de Sistemas')
    const materias = await solicitante.peticion('/materias', { parametros: { programa: programa.id }, autenticada: false })
    const materia = materias.find((fila) => fila.codigo === 'SIS-06')
    for (const [api, nombre, correo, quiereSerTutor] of [
      [tutor, 'Aurora Pinto', 'aurora.pinto', true],
      [solicitante, 'Benjamín Ortiz', 'benjamin.ortiz', false],
    ]) {
      const registro = await api.peticion('/auth/registro', {
        metodo: 'POST', datos: {
          nombre, correoInstitucional: `${correo}@uniguajira.edu.co`, clave: CLAVE_DE_PRUEBA,
          semestre: 5, sede: 'Riohacha', programa: programa.id, quiereSerTutor, aceptaTratamientoDatos: true,
        },
      })
      api.guardarToken(registro.token)
      assert.equal(registro.usuario.quiereSerTutor, quiereSerTutor)
      assert.equal(registro.usuario.consentimientoDatos.aceptado, true)
      assert.ok(!('claveHash' in registro.usuario))
    }
    await ingresar(coordinacion, CORREOS.administrador)
    const franja = { dia: 'LUNES', horaInicio: '18:00', horaFin: '20:00' }
    const perfil = await tutor.peticion('/tutores/mi-perfil', {
      metodo: 'PUT', datos: { biografia: 'Explico álgebra con ejercicios de parciales anteriores', tarifaHora: null, materias: [materia.id], disponibilidad: [franja] },
    })
    assert.equal(perfil.estadoVerificacion, 'PENDIENTE')
    assert.ok(!(await solicitante.peticion('/tutores', { parametros: { materia: materia.id } })).some((fila) => fila.id === perfil.id))
    await coordinacion.peticion(`/coordinacion/perfiles/${perfil.id}/verificar`, { metodo: 'PATCH' })
    const visibles = await solicitante.peticion('/tutores', { parametros: { materia: materia.id } })
    assert.equal(visibles.find((fila) => fila.id === perfil.id).promedio, 0)
    const datos = { tutor: perfil.id, materia: materia.id, fecha: lunes(4), franja, tema: 'Matrices y sistemas de ecuaciones lineales' }
    const sesion = await solicitante.peticion('/sesiones', { metodo: 'POST', datos })
    assert.equal(sesion.estado, 'PENDIENTE')
    assert.equal(sesion.tutor.estudiante.correoInstitucional, undefined)
    await assert.rejects(solicitante.peticion('/sesiones', { metodo: 'POST', datos }), (error) => error instanceof ErrorApi && error.status === 409 && error.regla === 'RQNF012')
    assert.deepEqual((await tutor.peticion('/sesiones', { parametros: { papel: 'TUTOR' } })).map((fila) => fila.id), [sesion.id])
    assert.equal((await tutor.peticion(`/sesiones/${sesion.id}/confirmar`, { metodo: 'PATCH' })).estado, 'CONFIRMADA')
    const ruta = `/sesiones/${sesion.id}/reprogramacion`
    await solicitante.peticion(ruta, { metodo: 'PUT', datos: { fecha: lunes(5), franja } })
    await assert.rejects(solicitante.peticion(ruta, { metodo: 'PATCH', datos: { acepta: true } }), { status: 403 })
    assert.equal((await tutor.peticion(ruta, { metodo: 'PATCH', datos: { acepta: true } })).fecha, lunes(5))
    await assert.rejects(tutor.peticion(`/sesiones/${sesion.id}/finalizar`, { metodo: 'PATCH' }), (error) => error.status === 409 && error.regla === 'R5')
    await moverAlPasado(sesion.id) // la tutoría ya ocurrió
    assert.equal((await tutor.peticion(`/sesiones/${sesion.id}/finalizar`, { metodo: 'PATCH' })).estado, 'FINALIZADA')
    await solicitante.peticion(`/sesiones/${sesion.id}/calificacion`, { metodo: 'POST', datos: { puntaje: 4, resena: 'Muy clara' } })
    const detalle = await solicitante.peticion(`/tutores/${perfil.id}`)
    assert.deepEqual([detalle.promedio, detalle.totalCalificaciones, detalle.tutoriasCompletadas], [4, 1, 1])
    assert.equal(detalle.resenas[0].autor, 'Benjamín O.')
    assert.equal((await solicitante.peticion(`/favoritos/${perfil.id}`, { metodo: 'PUT' }))[0].id, perfil.id)
    assert.deepEqual(await solicitante.peticion(`/favoritos/${perfil.id}`, { metodo: 'DELETE' }), [])
    assert.notEqual(tutor.obtenerToken(), solicitante.obtenerToken())
    assert.equal((await coordinacion.peticion('/auth/yo')).usuario.tipo, 'ADMINISTRADOR')
  })

  it('restaura sesión con el mismo almacén; 403 conserva el token y 401 lo elimina', async () => {
    const almacen = almacenEnMemoria()
    const primera = cliente({ almacen })
    await ingresar(primera, CORREOS.elena)
    let expiraciones = 0
    const recargada = cliente({ almacen, alExpirarSesion: () => { expiraciones += 1 } })
    assert.equal((await recargada.peticion('/auth/yo')).usuario.correoInstitucional, CORREOS.elena)
    const token = recargada.obtenerToken()
    await assert.rejects(recargada.peticion('/coordinacion/metricas'), { status: 403 })
    assert.equal(recargada.obtenerToken(), token)
    recargada.guardarToken('token-invalido-de-prueba')
    await assert.rejects(recargada.peticion('/auth/yo'), { status: 401 })
    assert.equal(recargada.obtenerToken(), null)
    assert.equal(expiraciones, 1)
  })

  describe('RQNF005: expiración por inactividad en el cliente', () => {
    function temporizadorFalso() {
      const alarmas = new Map()
      let siguiente = 0
      return {
        alarmas,
        programar: (fn, ms) => { alarmas.set(++siguiente, { fn, ms }); return siguiente },
        cancelar: (id) => alarmas.delete(id),
        disparar() { for (const [id, { fn }] of [...alarmas]) { alarmas.delete(id); fn() } },
      }
    }

    it('sin actividad: al vencer el token la alarma cierra la sesión y avisa una vez', async () => {
      const temporizador = temporizadorFalso()
      let expiraciones = 0
      const api = cliente({ temporizador, alExpirarSesion: () => { expiraciones += 1 } })
      await ingresar(api, CORREOS.elena)
      assert.equal(temporizador.alarmas.size, 1)
      const [{ ms }] = temporizador.alarmas.values()
      const ventana = aSegundos(env.sesionInactividad) * 1000
      assert.ok(ms > ventana - 5000 && ms <= ventana, `la alarma queda a ${ms} ms, cerca de ${ventana}`)
      temporizador.disparar()
      assert.equal(api.obtenerToken(), null)
      assert.equal(expiraciones, 1)
      await assert.rejects(api.peticion('/auth/yo'), { status: 401 })
    })

    it('con actividad: la respuesta trae un token renovado, se guarda y la alarma se reprograma', async () => {
      const temporizador = temporizadorFalso()
      const api = cliente({ temporizador })
      const ingreso = await ingresar(api, CORREOS.elena)
      const ahora = Math.floor(Date.now() / 1000)
      // Se conserva el identificador de la sesión única que abrió el ingreso
      const usado = jwt.sign({ rol: 'ESTUDIANTE', ini: ahora - 300, iat: ahora - 120, sid: jwt.decode(api.obtenerToken()).sid }, env.jwtSecreto, {
        subject: ingreso.id, expiresIn: aSegundos(env.sesionInactividad),
      })
      api.guardarToken(usado)
      const msAntes = [...temporizador.alarmas.values()][0].ms
      await api.peticion('/auth/yo')
      const renovado = api.obtenerToken()
      assert.notEqual(renovado, usado)
      assert.equal(jwt.decode(renovado).ini, ahora - 300)
      assert.equal(temporizador.alarmas.size, 1)
      assert.ok([...temporizador.alarmas.values()][0].ms > msAntes + 100_000, 'la ventana vuelve a empezar')
    })

    it('salir borra el token local y la API deja de aceptar una copia del anterior', async () => {
      const api = cliente()
      await ingresar(api, CORREOS.elena)
      const copia = api.obtenerToken()
      await api.salir()
      assert.equal(api.obtenerToken(), null)
      const otra = cliente()
      otra.guardarToken(copia)
      await assert.rejects(otra.peticion('/auth/yo'), { status: 401 })
    })

    it('solo la consulta automática envía la marca que no renueva el token', async () => {
      const usuario = { tipo: 'ESTUDIANTE' }
      const ahora = Math.floor(Date.now() / 1000)
      const viejo = jwt.sign({ rol: usuario.tipo, ini: ahora - 300, iat: ahora - 300 }, 'x', { subject: 'a'.repeat(24), expiresIn: 600 })
      const vistos = []
      const fetchImpl = async (url, opciones) => {
        vistos.push(opciones.headers)
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      const api = crearClienteApi({ urlBase: 'http://localhost:1/api', almacen: almacenEnMemoria(), fetchImpl })
      api.guardarToken(viejo)
      await api.peticion('/notificaciones', { automatica: true })
      await api.peticion('/notificaciones')
      assert.equal(vistos[0]['X-Consulta-Automatica'], '1')
      assert.equal(vistos[1]['X-Consulta-Automatica'], undefined)
    })

    it('cerrar sesión cancela la alarma y una alarma vieja no cierra una sesión nueva', async () => {
      const temporizador = temporizadorFalso()
      let expiraciones = 0
      const api = cliente({ temporizador, alExpirarSesion: () => { expiraciones += 1 } })
      await ingresar(api, CORREOS.elena)
      const vieja = [...temporizador.alarmas.values()][0]
      api.cerrarSesion()
      assert.equal(temporizador.alarmas.size, 0)
      await ingresar(api, CORREOS.elena)
      vieja.fn()
      assert.ok(api.obtenerToken())
      assert.equal(expiraciones, 0)
    })

    it('dos pestañas: si la otra renueva, esta sigue el nuevo vencimiento y al vencer también retira su sesión', async () => {
      const almacen = almacenEnMemoria()
      const relojA = temporizadorFalso(), relojB = temporizadorFalso()
      let avisosA = 0, avisosB = 0
      const pestanaA = cliente({ almacen, temporizador: relojA, alExpirarSesion: () => { avisosA += 1 } })
      const usuario = await ingresar(pestanaA, CORREOS.elena)
      const pestanaB = cliente({ almacen, temporizador: relojB, alExpirarSesion: () => { avisosB += 1 } })
      // B renueva la sesión compartida (token emitido hace 2 min)
      const ahora = Math.floor(Date.now() / 1000)
      almacen.setItem('ct.token', jwt.sign({ rol: 'ESTUDIANTE', ini: ahora - 120, iat: ahora - 120, sid: jwt.decode(almacen.getItem('ct.token')).sid }, env.jwtSecreto, {
        subject: usuario.id, expiresIn: aSegundos(env.sesionInactividad),
      }))
      await pestanaB.peticion('/auth/yo')
      const renovado = almacen.getItem('ct.token')
      // Vence la alarma vieja de A: no cierra nada y queda vigilando el token renovado
      relojA.disparar()
      assert.equal(almacen.getItem('ct.token'), renovado)
      assert.equal(avisosA, 0)
      assert.equal(relojA.alarmas.size, 1)
      // Vence la sesión renovada: B la cierra y A también retira su estado privado
      relojB.disparar()
      assert.equal(almacen.getItem('ct.token'), null)
      assert.equal(avisosB, 1)
      relojA.disparar()
      assert.equal(avisosA, 1)
      assert.equal(relojA.alarmas.size, 0)
    })

    it('vencimientoDelToken lee el exp del JWT y rechaza textos que no lo son', () => {
      const token = jwt.sign({ a: 1 }, 'x'.repeat(32), { expiresIn: 60 })
      assert.equal(vencimientoDelToken(token), jwt.decode(token).exp * 1000)
      assert.equal(vencimientoDelToken('no-es-un-token'), null)
    })
  })

  it('con la API apagada entrega error de red y permite reintentar conservando sesión', async () => {
    const temporal = app.listen(0, 'localhost')
    await once(temporal, 'listening')
    const api = cliente({ urlBase: `http://localhost:${temporal.address().port}/api` })
    api.guardarToken('token-local-de-prueba')
    assert.equal((await api.peticion('/salud')).baseDeDatos, 'conectada')
    await cerrarServidor(temporal)
    for (let intento = 0; intento < 2; intento += 1) {
      await assert.rejects(api.peticion('/salud', { signal: AbortSignal.timeout(3000) }), (error) => error instanceof ErrorApi && error.status === 0 && /No pudimos conectarnos/.test(error.message))
      assert.equal(api.obtenerToken(), 'token-local-de-prueba')
    }
  })
})
