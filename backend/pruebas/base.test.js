import { detenerBaseDePrueba, iniciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { after, before, describe, it } from 'node:test'
import express from 'express'
import mongoose from 'mongoose'
import request from 'supertest'
import { app } from '../src/app.js'
import { revisarConfiguracion } from '../src/config/env.js'
import { cerrarEnProduccion } from '../src/middlewares/cerrarEnProduccion.js'
import { manejarErrores, rutaNoEncontrada } from '../src/middlewares/manejarErrores.js'
import { Usuario } from '../src/models/index.js'
import * as rutasAuth from '../src/routes/auth.routes.js'

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

/** Configuración sintética de producción: no sale de ningún .env ni apunta a un servicio real. */
function configuracionSintetica(cambios = {}) {
  const { correo, ...resto } = cambios
  return {
    esProduccion: true,
    mongodbUri: 'mongodb://127.0.0.1:27017/conectatutor_pruebas',
    corsOrigenes: ['https://frontend.example.test'],
    jwtSecreto: 'secreto-sintetico-de-prueba-'.padEnd(40, 'x'),
    jwtDuracion: '2h',
    sesionInactividad: '30m',
    correo: { desvio: '', ...correo },
    ...resto,
  }
}

describe('D01 · Entradas de prueba cerradas en producción', () => {
  before(iniciarBaseDePrueba)
  after(detenerBaseDePrueba)

  it('las pruebas usan una base en memoria, en loopback y llamada conectatutor_pruebas', () => {
    assert.equal(mongoose.connection.name, 'conectatutor_pruebas')
    assert.match(mongoose.connection.host, /^(127\.0\.0\.1|localhost|::1)$/)
  })

  it('POST /api/auth/registro responde 404 en producción y no crea ninguna cuenta', async () => {
    const aplicacion = express()
    aplicacion.use(express.json())
    aplicacion.use('/api/auth', rutasAuth.crearAuthRouter({ esProduccion: true }))
    aplicacion.use(rutaNoEncontrada)
    aplicacion.use(manejarErrores)

    const antes = await Usuario.countDocuments()
    const respuesta = await request(aplicacion).post('/api/auth/registro').send({
      nombre: 'Cuenta Sintética',
      correoInstitucional: 'cuenta.sintetica@uniguajira.edu.co',
      clave: 'ClaveSintetica2026',
      aceptaTratamientoDatos: true,
    })
    assert.equal(respuesta.status, 404)
    assert.match(respuesta.headers['content-type'], /json/)
    assert.equal(await Usuario.countDocuments(), antes)
  })

  it('en producción el registro responde 404 también con un JSON mal escrito', async () => {
    const montar = (esProduccion) => {
      const aplicacion = express()
      aplicacion.post('/api/auth/registro', cerrarEnProduccion({ esProduccion }))
      aplicacion.use(express.json())
      aplicacion.use('/api/auth', rutasAuth.crearAuthRouter({ esProduccion }))
      aplicacion.use(rutaNoEncontrada)
      aplicacion.use(manejarErrores)
      return aplicacion
    }
    const enviar = (aplicacion) => request(aplicacion).post('/api/auth/registro').set('Content-Type', 'application/json').send('{"nombre": ')
    assert.equal((await enviar(montar(true))).status, 404)
    assert.equal((await enviar(montar(false))).status, 400)
  })

  it('la app real, arrancada como producción, responde 404 al registro aun con un JSON mal escrito', () => {
    const programa = `
      const { default: request } = await import('supertest')
      const { app } = await import('./src/app.js')
      const r = await request(app).post('/api/auth/registro').set('Content-Type', 'application/json').send('{"nombre": ')
      console.log(r.status)
    `
    const resultado = spawnSync(process.execPath, ['--input-type=module', '-e', programa], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', MONGODB_URI: 'mongodb://127.0.0.1:1/conectatutor_pruebas', JWT_SECRETO: 'secreto-sintetico-de-prueba-xxxxxxxxxxxx', CORS_ORIGIN: 'https://frontend.example.test' },
    })
    assert.equal(resultado.stdout.trim().split(/\r?\n/).pop(), '404', resultado.stderr)
  })

  it('en producción siguen abiertas las demás rutas de autenticación', async () => {
    const aplicacion = express()
    aplicacion.use(express.json())
    aplicacion.use('/api/auth', rutasAuth.crearAuthRouter({ esProduccion: true }))
    aplicacion.use(rutaNoEncontrada)
    aplicacion.use(manejarErrores)
    const respuesta = await request(aplicacion).post('/api/auth/ingreso').send({})
    assert.equal(respuesta.status, 400)
  })

  it('fuera de producción el registro sigue disponible (llega a la validación, no al 404)', async () => {
    const aplicacion = express()
    aplicacion.use(express.json())
    aplicacion.use('/api/auth', rutasAuth.crearAuthRouter({ esProduccion: false }))
    aplicacion.use(rutaNoEncontrada)
    aplicacion.use(manejarErrores)
    const respuesta = await request(aplicacion).post('/api/auth/registro').send({})
    assert.equal(respuesta.status, 400)
  })

  it('revisarConfiguracion rechaza CORREO_DESVIO en producción', () => {
    const problemas = revisarConfiguracion(configuracionSintetica({ correo: { desvio: 'demo@example.test' } }))
    assert.equal(problemas.length, 1)
    assert.match(problemas[0], /CORREO_DESVIO/)
  })

  it('revisarConfiguracion acepta una producción sin CORREO_DESVIO', () => {
    assert.deepEqual(revisarConfiguracion(configuracionSintetica()), [])
  })

  it('CORREO_DESVIO sigue permitido en demostraciones locales', () => {
    const local = configuracionSintetica({ esProduccion: false, mongodbUri: '', correo: { desvio: 'demo@example.test' } })
    assert.deepEqual(revisarConfiguracion(local), [])
  })
})
