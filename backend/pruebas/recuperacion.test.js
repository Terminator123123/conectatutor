import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { after, before, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { Programa, Usuario } from '../src/models/index.js'
import { bandejaDePrueba, correoDisponible } from '../src/services/correo.service.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { afirmarContrato } from './ayudas/contrato.js'
import { crearRetencion } from './ayudas/retencion.js'
import { clienteDe, CORREOS } from './ayudas/sesion.js'

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

  it('un cambio desde la cuenta que quedó a medias no sobrescribe un restablecimiento terminado', async () => {
    await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: CORREO })
    const token = tokenDelCorreo()
    const ingreso = await request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave: CLAVE_DE_PRUEBA })
    const CLAVE_CAMBIO = 'ClaveDelCambio9'
    const CLAVE_ENLACE = 'ClaveDelEnlace9'

    // Se detiene el cambio justo después de comprobar la contraseña actual, mientras cifra la nueva
    const retencion = crearRetencion()
    const hashOriginal = bcrypt.hash
    bcrypt.hash = async function (clave, ...resto) {
      if (clave === CLAVE_CAMBIO) await retencion.detener()
      return hashOriginal.call(this, clave, ...resto)
    }
    let cambioPendiente
    try {
      cambioPendiente = request(app).put('/api/auth/yo/clave').set('Authorization', `Bearer ${ingreso.body.token}`)
        .send({ claveActual: CLAVE_DE_PRUEBA, claveNueva: CLAVE_CAMBIO })
        .then((respuesta) => respuesta)
      // Si el cambio terminara sin llegar al cifrado, la prueba falla en vez de quedarse esperando
      await retencion.esperarLlegada(cambioPendiente)
      const restablecer = await request(app).post('/api/auth/recuperacion/restablecer').send({ token, clave: CLAVE_ENLACE })
      assert.equal(restablecer.status, 200)
      retencion.soltar()
      const cambio = await cambioPendiente
      assert.equal(cambio.status, 409)
      await afirmarContrato(cambio, '/auth/yo/clave', 'put')
    } finally {
      // Pase lo que pase, el cambio retenido se libera y termina antes de seguir
      retencion.soltar()
      bcrypt.hash = hashOriginal
      await cambioPendiente?.catch(() => {})
    }

    reiniciarIntentos()
    const conEnlace = await request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave: CLAVE_ENLACE })
    const conCambio = await request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave: CLAVE_CAMBIO })
    assert.equal(conEnlace.status, 200)
    assert.equal(conCambio.status, 401)
  })

  it('un ingreso con la contraseña vieja que quedó a medias no abre sesión después de restablecerla', async () => {
    await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: CORREO })
    const token = tokenDelCorreo()
    const retencion = crearRetencion()
    const compararOriginal = bcrypt.compare
    // Retiene el ingreso justo después de comparar la contraseña, antes de abrir la sesión
    bcrypt.compare = async function (...argumentos) {
      const coincide = await compararOriginal.apply(this, argumentos)
      if (argumentos[0] === CLAVE_DE_PRUEBA) await retencion.detener()
      return coincide
    }
    let ingresoPendiente
    try {
      ingresoPendiente = request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave: CLAVE_DE_PRUEBA })
        .then((respuesta) => respuesta)
      await retencion.esperarLlegada(ingresoPendiente)
      const restablecer = await request(app).post('/api/auth/recuperacion/restablecer').send({ token, clave: 'ClaveRecuperada9' })
      assert.equal(restablecer.status, 200)
      retencion.soltar()
      const ingreso = await ingresoPendiente
      assert.equal(ingreso.status, 401)
      assert.equal(ingreso.body.token, undefined)
      await afirmarContrato(ingreso, '/auth/ingreso', 'post')
    } finally {
      retencion.soltar()
      bcrypt.compare = compararOriginal
      await ingresoPendiente?.catch(() => {})
    }
    reiniciarIntentos()
    assert.equal((await request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave: 'ClaveRecuperada9' })).status, 200)
  })

  it('si una recuperación termina mientras se activa la cuenta, el 409 lo dice y la cuenta sigue sin activar', async () => {
    const coordinacion = await clienteDe(CORREOS.administrador)
    const NUEVA = 'cuenta.recuperada@uniguajira.edu.co'
    const DOCUMENTO = '1033445566'
    const CLAVE_ACTIVACION = 'ClaveDeActivacion9'
    const CLAVE_ENLACE = 'ClaveDelEnlace9'
    const creada = await coordinacion.post('/coordinacion/cuentas', {
      nombre: 'Cuenta Recuperada', correoInstitucional: NUEVA, documento: DOCUMENTO, semestre: 1, sede: 'Riohacha', programa: (await Programa.findOne()).id,
    })
    assert.equal(creada.status, 201)
    const ingreso = await request(app).post('/api/auth/ingreso').send({ correoInstitucional: NUEVA, clave: DOCUMENTO })
    await request(app).post('/api/auth/recuperacion').send({ correoInstitucional: NUEVA })
    const token = tokenDelCorreo()

    // La activación se detiene mientras cifra la contraseña nueva; entretanto se usa el enlace de recuperación
    const retencion = crearRetencion()
    const hashOriginal = bcrypt.hash
    bcrypt.hash = async function (clave, ...resto) {
      if (clave === CLAVE_ACTIVACION) await retencion.detener()
      return hashOriginal.call(this, clave, ...resto)
    }
    let activacion
    try {
      activacion = request(app).post('/api/auth/yo/primer-acceso').set('Authorization', `Bearer ${ingreso.body.token}`)
        .send({ claveNueva: CLAVE_ACTIVACION, quiereSerTutor: false, aceptaTratamientoDatos: true })
        .then((respuesta) => respuesta)
      await retencion.esperarLlegada(activacion)
      assert.equal((await request(app).post('/api/auth/recuperacion/restablecer').send({ token, clave: CLAVE_ENLACE })).status, 200)
      retencion.soltar()
      const respuesta = await activacion
      assert.equal(respuesta.status, 409)
      assert.match(respuesta.body.mensaje, /restableció con un enlace de recuperación/)
      assert.doesNotMatch(respuesta.body.mensaje, /ya está activada/)
      await afirmarContrato(respuesta, '/auth/yo/primer-acceso', 'post')
    } finally {
      retencion.soltar()
      bcrypt.hash = hashOriginal
      await activacion?.catch(() => {})
    }

    reiniciarIntentos()
    const conEnlace = await request(app).post('/api/auth/ingreso').send({ correoInstitucional: NUEVA, clave: CLAVE_ENLACE })
    assert.equal(conEnlace.status, 200)
    assert.equal(conEnlace.body.usuario.primerAccesoPendiente, true, 'la cuenta sigue pidiendo la activación')
    assert.equal((await request(app).post('/api/auth/ingreso').send({ correoInstitucional: NUEVA, clave: CLAVE_ACTIVACION })).status, 401)
  })

  it('en producción sin cuenta de correo no hay recuperación (no se escriben enlaces en el registro)', () => {
    const produccion = { esPrueba: false, esProduccion: true, correo: { usuario: '', claveApp: '' } }
    assert.equal(correoDisponible(produccion), false)
    assert.equal(correoDisponible({ ...produccion, correo: { usuario: 'a@b.co', claveApp: 'x' } }), true)
    assert.equal(correoDisponible({ ...produccion, esProduccion: false }), true)
  })
})
