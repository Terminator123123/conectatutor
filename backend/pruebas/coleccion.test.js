import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, beforeEach, describe, it } from 'node:test'
import mongoose from 'mongoose'
import { app } from '../src/app.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { hoyEnColombia } from '../src/utils/fechas.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { ejecutarColeccion } from './ayudas/ejecutarColeccion.js'
import { CORREOS } from './ayudas/sesion.js'

describe('E6 · Colección exportada y concurrencia por HTTP real', () => {
  let servidor, urlBase
  before(async () => {
    await iniciarBaseDePrueba()
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(mongoose.connection.host))
    assert.equal(mongoose.connection.name, 'conectatutor_pruebas')
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
    try {
      if (servidor) await new Promise((resolver, rechazar) => {
        servidor.close(error => error ? rechazar(error) : resolver())
        servidor.closeAllConnections()
      })
    } finally {
      await detenerBaseDePrueba()
    }
  })

  async function pedir(ruta, { metodo = 'GET', token, datos } = {}) {
    const respuesta = await fetch(`${urlBase}${ruta}`, {
      method: metodo,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(datos ? { 'Content-Type': 'application/json' } : {}) },
      ...(datos ? { body: JSON.stringify(datos) } : {}),
      signal: AbortSignal.timeout(10000), redirect: 'error',
    })
    return { estado: respuesta.status, datos: await respuesta.json() }
  }

  async function ingresar(correo) {
    const respuesta = await pedir('/auth/ingreso', { metodo: 'POST', datos: { correoInstitucional: correo, clave: CLAVE_DE_PRUEBA } })
    assert.equal(respuesta.estado, 200)
    return respuesta.datos
  }

  async function prepararSolicitud() {
    const [tutor, elena, felipe] = await Promise.all([ingresar(CORREOS.bruno), ingresar(CORREOS.elena), ingresar(CORREOS.felipe)])
    const respuesta = await pedir('/tutores/mi-perfil', { token: tutor.token })
    assert.equal(respuesta.estado, 200)
    const perfil = respuesta.datos
    const franja = perfil.disponibilidad.find(franja => franja.dia === 'LUNES')
    const fecha = new Date(`${hoyEnColombia()}T00:00:00Z`)
    fecha.setUTCDate(fecha.getUTCDate() + 21)
    while (fecha.getUTCDay() !== 1) fecha.setUTCDate(fecha.getUTCDate() + 1)
    const datos = { tutor: perfil.id, materia: perfil.materias[0].id, fecha: fecha.toISOString().slice(0, 10), franja,
      tema: 'Resolver ejercicios de planeación' }
    return { tutor, elena, felipe, perfil, datos }
  }

  it('ejecuta las 65 peticiones y los scripts de la colección Postman exportada', async t => {
    const resultados = await ejecutarColeccion(urlBase, resultado => t.diagnostic(`${resultado.caso}: HTTP ${resultado.http}`))
    assert.equal(resultados.length, 65)
    assert.ok(resultados.every(resultado => resultado.pruebas.every(prueba => prueba.cumple)))
    assert.ok(resultados.every(resultado => !('token' in resultado) && !('cuerpo' in resultado)))
  })

  it('dos solicitantes simultáneos obtienen una sola reserva y la cancelación la libera', async () => {
    const { tutor, elena, felipe, perfil, datos } = await prepararSolicitud()
    const respuestas = await Promise.all([elena, felipe].map(cuenta => pedir('/sesiones', { metodo: 'POST', token: cuenta.token, datos })))
    assert.deepEqual(respuestas.map(respuesta => respuesta.estado).sort(), [201, 409])
    const ganadora = respuestas.find(respuesta => respuesta.estado === 201)
    assert.equal(respuestas.find(respuesta => respuesta.estado === 409).datos.regla, 'RQNF012')
    const ocupacion = await pedir(`/tutores/${perfil.id}/ocupacion`, { token: tutor.token })
    assert.equal(ocupacion.datos.filter(reserva => reserva.fecha === datos.fecha).length, 1)
    const cancelada = await pedir(`/sesiones/${ganadora.datos.id}/cancelar`, { metodo: 'PATCH', token: tutor.token, datos: { motivo: 'Liberar reserva de prueba' } })
    assert.equal(cancelada.estado, 200)
    assert.equal((await pedir('/sesiones', { metodo: 'POST', token: elena.token, datos })).estado, 201)
  })

  it('RQF002: elegir aprender u omitir la elección conserva estudiante sin activar un perfil', async () => {
    const programas = await pedir('/programas')
    assert.equal(programas.estado, 200)
    for (const eleccion of [false, undefined]) {
      const datos = { nombre: 'Estudiante de prueba', correoInstitucional: `qa.aprender.${String(eleccion)}@uniguajira.edu.co`,
        clave: CLAVE_DE_PRUEBA, semestre: 2, sede: 'Riohacha', programa: programas.datos[0].id,
        aceptaTratamientoDatos: true, ...(eleccion === false ? { quiereSerTutor: false } : {}) }
      const registro = await pedir('/auth/registro', { metodo: 'POST', datos })
      assert.equal(registro.estado, 201)
      const token = registro.datos.token
      const propia = (await pedir('/auth/yo', { token })).datos.usuario
      assert.equal(propia.tipo, 'ESTUDIANTE')
      assert.equal(propia.quiereSerTutor, false)
      assert.equal(propia.perfilTutor, null)
      assert.equal((await pedir('/tutores/mi-perfil', { token })).estado, 404)
    }
  })

  it('dos calificaciones simultáneas conservan una nota y un promedio coherente', async () => {
    const { tutor, elena, perfil, datos } = await prepararSolicitud()
    const creada = await pedir('/sesiones', { metodo: 'POST', token: elena.token, datos })
    assert.equal(creada.estado, 201)
    const ruta = `/sesiones/${creada.datos.id}`
    assert.equal((await pedir(`${ruta}/confirmar`, { metodo: 'PATCH', token: tutor.token })).estado, 200)
    assert.equal((await pedir(`${ruta}/finalizar`, { metodo: 'PATCH', token: tutor.token })).estado, 200)
    const respuestas = await Promise.all([4, 5].map(puntaje => pedir(`${ruta}/calificacion`, { metodo: 'POST', token: elena.token, datos: { puntaje, resena: 'Explicación de prueba' } })))
    assert.deepEqual(respuestas.map(respuesta => respuesta.estado).sort(), [201, 409])
    assert.equal(respuestas.find(respuesta => respuesta.estado === 409).datos.regla, 'R6')
    const nota = respuestas.find(respuesta => respuesta.estado === 201).datos.calificacion.puntaje
    const resumen = await pedir(`/tutores/${perfil.id}`, { token: elena.token })
    assert.equal(resumen.datos.totalCalificaciones, 1)
    assert.equal(resumen.datos.promedio, nota)
    assert.equal((await pedir(ruta, { token: elena.token })).datos.calificacion.puntaje, nota)
  })
})
