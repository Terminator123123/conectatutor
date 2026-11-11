import { detenerBaseDePrueba, iniciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'

describe('E1 · Base de la API', () => {
  before(iniciarBaseDePrueba)
  after(detenerBaseDePrueba)

  it('GET /api/salud responde 200 e informa la base de datos', async () => {
    const respuesta = await request(app).get('/api/salud')
    assert.equal(respuesta.status, 200)
    assert.equal(respuesta.body.estado, 'ok')
    assert.equal(respuesta.body.baseDeDatos, 'conectada')
    assert.ok(!Number.isNaN(Date.parse(respuesta.body.fecha)))
  })

  it('GET /api/docs/ abre la documentación Swagger', async () => {
    const respuesta = await request(app).get('/api/docs/')
    assert.equal(respuesta.status, 200)
    assert.match(respuesta.headers['content-type'], /html/)
    assert.match(respuesta.text, /swagger-ui/)
  })

  it('GET /api/docs.json entrega el documento OpenAPI con la ruta de salud', async () => {
    const respuesta = await request(app).get('/api/docs.json')
    assert.equal(respuesta.status, 200)
    assert.equal(respuesta.body.openapi, '3.0.3')
    assert.ok(respuesta.body.paths['/salud'].get)
  })

  it('una ruta que no existe responde 404 en JSON', async () => {
    const respuesta = await request(app).get('/api/no-existe')
    assert.equal(respuesta.status, 404)
    assert.match(respuesta.headers['content-type'], /json/)
    assert.match(respuesta.body.mensaje, /no existe/)
  })

  it('un JSON mal escrito responde 400 con mensaje claro', async () => {
    const respuesta = await request(app)
      .post('/api/salud')
      .set('Content-Type', 'application/json')
      .send('{"nombre": ')
    assert.equal(respuesta.status, 400)
    assert.equal(respuesta.body.mensaje, 'El cuerpo de la petición no es un JSON válido')
  })

  it('un cuerpo con codificación o compresión no soportada responde 415, no 500', async () => {
    const charset = await request(app)
      .post('/api/salud')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send('{}')
    assert.equal(charset.status, 415)
    assert.match(charset.body.mensaje, /UTF-8/)

    const compresion = await request(app)
      .post('/api/salud')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'invalid')
      .send('{}')
    assert.equal(compresion.status, 415)
  })

  it('un cuerpo de más de 100 kb responde 413', async () => {
    const respuesta = await request(app).post('/api/salud').send({ relleno: 'x'.repeat(120 * 1024) })
    assert.equal(respuesta.status, 413)
  })

  it('las respuestas llevan encabezados de seguridad y no anuncian Express', async () => {
    const respuesta = await request(app).get('/api/salud')
    assert.equal(respuesta.headers['x-powered-by'], undefined)
    assert.equal(respuesta.headers['x-content-type-options'], 'nosniff')
  })

  it('CORS solo autoriza el origen configurado', async () => {
    const permitido = await request(app).get('/api/salud').set('Origin', 'http://localhost:5173')
    assert.equal(permitido.headers['access-control-allow-origin'], 'http://localhost:5173')
    const ajeno = await request(app).get('/api/salud').set('Origin', 'http://sitio-ajeno.example')
    assert.equal(ajeno.headers['access-control-allow-origin'], undefined)
  })
})
