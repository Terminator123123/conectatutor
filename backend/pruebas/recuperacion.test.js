import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { Usuario } from '../src/models/index.js'
import { bandejaDePrueba, correoDisponible } from '../src/services/correo.service.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { afirmarContrato } from './ayudas/contrato.js'

const CORREO = 'elena.lozano@uniguajira.edu.co'
const tokenDelCorreo = () => /token=([\w-]+)/.exec(bandejaDePrueba.at(-1).texto)[1]

describe('Recuperación de acceso por correo', () => {
  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    reiniciarIntentos()
    bandejaDePrueba.length = 0
    await cargarSemilla(CLAVE_DE_PRUEBA)
  })
  after(detenerBaseDePrueba)

  it('envía un enlace al correo registrado y guarda solo su hash', async () => {
    const respuesta = await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: CORREO })
    assert.equal(respuesta.status, 202)
    await afirmarContrato(respuesta, '/auth/recuperacion', 'post')
    assert.equal(bandejaDePrueba.length, 1)
    assert.equal(bandejaDePrueba[0].para, CORREO)
    const token = tokenDelCorreo()
    const guardado = await Usuario.findOne({ correoInstitucional: CORREO }).select('+recuperacion.tokenHash +recuperacion.vence')
    assert.notEqual(guardado.recuperacion.tokenHash, token)
    assert.ok(guardado.recuperacion.vence > new Date())
    assert.doesNotMatch(JSON.stringify(respuesta.body), /token/i)
  })

  it('responde igual con un correo que no está registrado y no envía nada', async () => {
    const respuesta = await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: 'nadie.aqui@uniguajira.edu.co' })
    assert.equal(respuesta.status, 202)
    assert.equal(bandejaDePrueba.length, 0)
  })

  it('rechaza un correo que no es institucional y frena los pedidos repetidos', async () => {
    assert.equal((await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: 'x@gmail.com' })).status, 400)
    for (let i = 0; i < 3; i++) await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: CORREO })
    const cuarto = await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: CORREO })
    assert.equal(cuarto.status, 429)
  })

  it('cambia la contraseña con el enlace, que después deja de servir', async () => {
    await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: CORREO })
    const token = tokenDelCorreo()
    assert.equal((await request(app).post('/api/auth/recuperacion/comprobar').send({ token })).status, 200)
    assert.equal((await request(app).post('/api/auth/recuperacion/restablecer').send({ token, clave: 'corta' })).status, 400)
    const cambio = await request(app).post('/api/auth/recuperacion/restablecer').send({ token, clave: 'ClaveRecuperada9' })
    assert.equal(cambio.status, 200)
    await afirmarContrato(cambio, '/auth/recuperacion/restablecer', 'post')
    assert.equal((await request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave: 'ClaveRecuperada9' })).status, 200)
    assert.equal((await request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave: CLAVE_DE_PRUEBA })).status, 401)
    assert.equal((await request(app).post('/api/auth/recuperacion/comprobar').send({ token })).status, 400)
    assert.equal((await request(app).post('/api/auth/recuperacion/restablecer').send({ token, clave: 'OtraClave10' })).status, 400)
  })

  it('no acepta un enlace vencido ni uno inventado', async () => {
    await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: CORREO })
    const token = tokenDelCorreo()
    await Usuario.updateOne({ correoInstitucional: CORREO }, { $set: { 'recuperacion.vence': new Date(Date.now() - 1000) } })
    assert.equal((await request(app).post('/api/auth/recuperacion/restablecer').send({ token, clave: 'ClaveRecuperada9' })).status, 400)
    assert.equal((await request(app).post('/api/auth/recuperacion/comprobar').send({ token: 'inventado' })).status, 400)
  })

  it('un mismo enlace usado varias veces a la vez cambia la contraseña una sola vez', async () => {
    await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: CORREO })
    const token = tokenDelCorreo()
    const claves = Array.from({ length: 8 }, (_, i) => `ClaveCarrera${i}x`)
    const respuestas = await Promise.all(claves.map((clave) =>
      request(app).post('/api/auth/recuperacion/restablecer').send({ token, clave })))
    const ganadoras = respuestas.filter((r) => r.status === 200)
    assert.equal(ganadoras.length, 1)
    assert.ok(respuestas.every((r) => r.status === 200 || r.status === 400))
    const usada = claves[respuestas.findIndex((r) => r.status === 200)]
    reiniciarIntentos()
    const ingresos = await Promise.all(claves.map((clave) =>
      request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave })))
    assert.deepEqual(ingresos.map((r, i) => r.status === 200 ? claves[i] : null).filter(Boolean), [usada])
  })

  it('cambiar la contraseña desde la cuenta invalida un enlace pedido antes', async () => {
    await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: CORREO })
    const token = tokenDelCorreo()
    const ingreso = await request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave: CLAVE_DE_PRUEBA })
    const cambio = await request(app).put('/api/auth/yo/clave').set('Authorization', `Bearer ${ingreso.body.token}`)
      .send({ claveActual: CLAVE_DE_PRUEBA, claveNueva: 'ClaveDeCuenta9' })
    assert.equal(cambio.status, 200)
    const comprobar = await request(app).post('/api/auth/recuperacion/comprobar').send({ token })
    assert.equal(comprobar.status, 400)
    const usar = await request(app).post('/api/auth/recuperacion/restablecer').send({ token, clave: 'ClaveDelEnlace9' })
    assert.equal(usar.status, 400)
  })

  it('en producción sin cuenta de correo no hay recuperación (no se escriben enlaces en el registro)', () => {
    const produccion = { esPrueba: false, esProduccion: true, correo: { usuario: '', claveApp: '' } }
    assert.equal(correoDisponible(produccion), false)
    assert.equal(correoDisponible({ ...produccion, correo: { usuario: 'a@b.co', claveApp: 'x' } }), true)
    assert.equal(correoDisponible({ ...produccion, esProduccion: false }), true)
  })
})
