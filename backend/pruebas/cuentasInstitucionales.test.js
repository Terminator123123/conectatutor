import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { Programa, Usuario } from '../src/models/index.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { afirmarContrato } from './ayudas/contrato.js'
import { clienteDe, CORREOS } from './ayudas/sesion.js'

const NUEVA = 'laura.perez@uniguajira.edu.co'
const DOCUMENTO = '1122334455'

describe('Cuentas creadas por Coordinación y primer acceso (RQF001, RQF002, RQNF009)', () => {
  let coordinacion, programa
  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    reiniciarIntentos()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    coordinacion = await clienteDe(CORREOS.administrador)
    programa = (await Programa.findOne()).id
  })
  after(detenerBaseDePrueba)

  const datosCuenta = (cambios = {}) => ({
    nombre: 'Laura Pérez', correoInstitucional: NUEVA, documento: DOCUMENTO, semestre: 1, sede: 'Riohacha', programa, ...cambios,
  })
  const ingresar = (clave = DOCUMENTO) => request(app).post('/api/auth/ingreso').send({ correoInstitucional: NUEVA, clave })

  it('Coordinación crea la cuenta con el documento como contraseña inicial, sin guardarlo en claro', async () => {
    const respuesta = await coordinacion.post('/coordinacion/cuentas', datosCuenta())
    assert.equal(respuesta.status, 201)
    await afirmarContrato(respuesta, '/coordinacion/cuentas', 'post')
    assert.equal(respuesta.body.usuario.primerAccesoPendiente, true)
    assert.equal(respuesta.body.usuario.consentimientoDatos.aceptado, false)
    assert.doesNotMatch(JSON.stringify(respuesta.body), new RegExp(DOCUMENTO))
    const guardada = await Usuario.findOne({ correoInstitucional: NUEVA }).select('+claveHash')
    assert.notEqual(guardada.claveHash, DOCUMENTO)
    const ingreso = await ingresar()
    assert.equal(ingreso.status, 200)
    assert.equal(ingreso.body.usuario.primerAccesoPendiente, true)
  })

  it('solo Coordinación crea cuentas; valida los datos y no repite correos', async () => {
    const estudiante = await clienteDe(CORREOS.elena)
    assert.equal((await estudiante.post('/coordinacion/cuentas', datosCuenta())).status, 403)
    assert.equal((await request(app).post('/api/coordinacion/cuentas').send(datosCuenta())).status, 401)
    const malos = await coordinacion.post('/coordinacion/cuentas', datosCuenta({ documento: '12.345', correoInstitucional: 'x@gmail.com', sede: 'Luna' }))
    assert.equal(malos.status, 400)
    assert.equal(malos.body.errores.length, 3)
    assert.equal((await coordinacion.post('/coordinacion/cuentas', datosCuenta())).status, 201)
    assert.equal((await coordinacion.post('/coordinacion/cuentas', datosCuenta({ correoInstitucional: NUEVA.toUpperCase() }))).status, 409)
  })

  it('una cuenta sin activar puede consultar, pero no cambiar nada hasta el primer acceso', async () => {
    await coordinacion.post('/coordinacion/cuentas', datosCuenta())
    const { token } = (await ingresar()).body
    const conToken = (peticion) => peticion.set('Authorization', `Bearer ${token}`)
    assert.equal((await conToken(request(app).get('/api/auth/yo'))).status, 200)
    const bloqueada = await conToken(request(app).put('/api/auth/yo/clave')).send({ claveActual: DOCUMENTO, claveNueva: 'OtraClave12' })
    assert.equal(bloqueada.status, 403)
    assert.equal(bloqueada.body.regla, 'PRIMER_ACCESO')
  })

  it('el primer acceso exige contraseña distinta del documento, elección de uso y consentimiento', async () => {
    await coordinacion.post('/coordinacion/cuentas', datosCuenta())
    const { token } = (await ingresar()).body
    const primerAcceso = (cuerpo) => request(app).post('/api/auth/yo/primer-acceso').set('Authorization', `Bearer ${token}`).send(cuerpo)

    const sinConsentimiento = await primerAcceso({ claveNueva: 'MiClave2026', quiereSerTutor: true })
    assert.equal(sinConsentimiento.status, 400)
    const igualAlDocumento = await primerAcceso({ claveNueva: `${DOCUMENTO}a`, quiereSerTutor: true, aceptaTratamientoDatos: true })
    assert.equal(igualAlDocumento.status, 200, 'una clave distinta del documento sí sirve')

    const yaActivada = await primerAcceso({ claveNueva: 'MiClave2026', quiereSerTutor: false, aceptaTratamientoDatos: true })
    assert.equal(yaActivada.status, 409)
    assert.equal((await ingresar()).status, 401, 'el documento deja de servir como contraseña')
    const conNueva = await ingresar(`${DOCUMENTO}a`)
    assert.equal(conNueva.status, 200)
    assert.equal(conNueva.body.usuario.primerAccesoPendiente, false)
    assert.equal(conNueva.body.usuario.quiereSerTutor, true)
    assert.equal(conNueva.body.usuario.consentimientoDatos.aceptado, true)
  })

  it('rechaza usar el mismo documento como contraseña nueva', async () => {
    await coordinacion.post('/coordinacion/cuentas', datosCuenta())
    const { token } = (await ingresar()).body
    const respuesta = await request(app).post('/api/auth/yo/primer-acceso').set('Authorization', `Bearer ${token}`)
      .send({ claveNueva: DOCUMENTO, quiereSerTutor: false, aceptaTratamientoDatos: true })
    assert.equal(respuesta.status, 400)
  })

  it('el primer acceso responde según el contrato y deja la cuenta lista para solicitar', async () => {
    await coordinacion.post('/coordinacion/cuentas', datosCuenta())
    const { token } = (await ingresar()).body
    const respuesta = await request(app).post('/api/auth/yo/primer-acceso').set('Authorization', `Bearer ${token}`)
      .send({ claveNueva: 'MiClave2026', quiereSerTutor: false, aceptaTratamientoDatos: true })
    assert.equal(respuesta.status, 200)
    await afirmarContrato(respuesta, '/auth/yo/primer-acceso', 'post')
    assert.equal(respuesta.body.usuario.primerAccesoPendiente, false)
    const cambio = await request(app).put('/api/auth/yo/clave').set('Authorization', `Bearer ${token}`)
      .send({ claveActual: 'MiClave2026', claveNueva: 'OtraClave12' })
    assert.equal(cambio.status, 200)
  })
})
