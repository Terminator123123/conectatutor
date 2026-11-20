import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { after, before, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { afirmarContrato } from './ayudas/contrato.js'
import { crearRetencion } from './ayudas/retencion.js'

const CORREO = 'elena.lozano@uniguajira.edu.co'
// PNG de 1 × 1 píxel
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

async function tokenDe(correo, clave = CLAVE_DE_PRUEBA) {
  return (await request(app).post('/api/auth/ingreso').send({ correoInstitucional: correo, clave })).body.token
}

describe('Cuenta propia: contraseña y foto', () => {
  let token, id
  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    reiniciarIntentos()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    token = await tokenDe(CORREO)
    id = (await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${token}`)).body.usuario.id
  })
  after(detenerBaseDePrueba)

  it('cambia la contraseña pidiendo la actual', async () => {
    const con = (ruta) => request(app).put(ruta).set('Authorization', `Bearer ${token}`)
    const mala = await con('/api/auth/yo/clave').send({ claveActual: 'NoEsEsta1', claveNueva: 'ClaveNueva22' })
    assert.equal(mala.status, 400)
    assert.equal((await con('/api/auth/yo/clave').send({ claveActual: CLAVE_DE_PRUEBA, claveNueva: 'corta' })).status, 400)
    assert.equal((await con('/api/auth/yo/clave').send({ claveActual: CLAVE_DE_PRUEBA, claveNueva: CLAVE_DE_PRUEBA })).status, 400)
    const bien = await con('/api/auth/yo/clave').send({ claveActual: CLAVE_DE_PRUEBA, claveNueva: 'ClaveNueva22' })
    assert.equal(bien.status, 200)
    await afirmarContrato(bien, '/auth/yo/clave', 'put')
    assert.ok(await tokenDe(CORREO, 'ClaveNueva22'))
    assert.equal(await tokenDe(CORREO), undefined)
    assert.equal((await request(app).put('/api/auth/yo/clave').send({ claveActual: 'a', claveNueva: 'ClaveNueva33' })).status, 401)
  })

  it('de dos cambios de contraseña simultáneos gana el primero en guardarse; el otro recibe 409 y no la pisa', async () => {
    const con = () => request(app).put('/api/auth/yo/clave').set('Authorization', `Bearer ${token}`)
    // El primer cambio se detiene mientras cifra su contraseña nueva; entretanto otro cambio termina
    const retencion = crearRetencion()
    const hashOriginal = bcrypt.hash
    bcrypt.hash = async function (clave, ...resto) {
      if (clave === 'ClavePrimera1') await retencion.detener()
      return hashOriginal.call(this, clave, ...resto)
    }
    let primero
    try {
      primero = con().send({ claveActual: CLAVE_DE_PRUEBA, claveNueva: 'ClavePrimera1' }).then((respuesta) => respuesta)
      await retencion.esperarLlegada(primero)
      assert.equal((await con().send({ claveActual: CLAVE_DE_PRUEBA, claveNueva: 'ClaveSegunda2' })).status, 200)
      retencion.soltar()
      const atrasado = await primero
      assert.equal(atrasado.status, 409)
      assert.match(atrasado.body.mensaje, /cambió mientras se guardaba este cambio/)
      await afirmarContrato(atrasado, '/auth/yo/clave', 'put')
    } finally {
      retencion.soltar()
      bcrypt.hash = hashOriginal
      await primero?.catch(() => {})
    }
    reiniciarIntentos()
    assert.ok(await tokenDe(CORREO, 'ClaveSegunda2'))
    assert.equal(await tokenDe(CORREO, 'ClavePrimera1'), undefined)
  })

  it('guarda, muestra y quita la foto de perfil', async () => {
    assert.equal((await request(app).get(`/api/usuarios/${id}/foto`)).status, 204)
    const subida = await request(app).put('/api/auth/yo/foto').set('Authorization', `Bearer ${token}`).send({ imagen: PNG })
    assert.equal(subida.status, 200)
    const foto = await request(app).get(`/api/usuarios/${id}/foto`)
    assert.equal(foto.status, 200)
    assert.equal(foto.headers['content-type'], 'image/png')
    assert.equal((await request(app).get(`/api/usuarios/${id}/foto`).set('If-None-Match', foto.headers.etag)).status, 304)
    assert.doesNotMatch(JSON.stringify((await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${token}`)).body), /foto/)
    assert.equal((await request(app).delete('/api/auth/yo/foto').set('Authorization', `Bearer ${token}`)).status, 204)
    assert.equal((await request(app).get(`/api/usuarios/${id}/foto`)).status, 204)
  })

  it('rechaza archivos que no son imagen aunque digan serlo, y los muy pesados', async () => {
    const enviar = (imagen) => request(app).put('/api/auth/yo/foto').set('Authorization', `Bearer ${token}`).send({ imagen })
    assert.equal((await enviar('data:image/png;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64'))).status, 400)
    assert.equal((await enviar('hola')).status, 400)
    const grande = Buffer.alloc(210 * 1024); grande.set([0xff, 0xd8, 0xff])
    assert.equal((await enviar('data:image/jpeg;base64,' + grande.toString('base64'))).status, 400)
    assert.equal((await request(app).put('/api/auth/yo/foto').send({ imagen: PNG })).status, 401)
  })
})
