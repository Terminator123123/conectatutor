import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { app } from '../src/app.js'
import { env } from '../src/config/env.js'
import { autenticar, exigirRol } from '../src/middlewares/autenticar.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { manejarErrores } from '../src/middlewares/manejarErrores.js'
import { Programa, Usuario } from '../src/models/index.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { afirmarContrato } from './ayudas/contrato.js'

const CORREO_ESTUDIANTE = 'elena.lozano@uniguajira.edu.co'
const CORREO_ADMINISTRADOR = 'gabriela.montes@uniguajira.edu.co'

let programaId

/** Datos de registro válidos; cada prueba cambia lo que necesita. */
function datosRegistro(cambios = {}) {
  return {
    nombre: 'Hernán Pimienta',
    correoInstitucional: 'hernan.pimienta@uniguajira.edu.co',
    clave: 'ClaveNueva2026',
    semestre: 3,
    sede: 'Riohacha',
    programa: programaId,
    aceptaTratamientoDatos: true,
    ...cambios,
  }
}

async function ingresar(correoInstitucional, clave = CLAVE_DE_PRUEBA) {
  return request(app).post('/api/auth/ingreso').send({ correoInstitucional, clave })
}

describe('E2 · Autenticación', () => {
  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    reiniciarIntentos()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    programaId = (await Programa.findOne({ nombre: 'Ingeniería de Sistemas' })).id
  })
  after(detenerBaseDePrueba)

  describe('POST /api/auth/registro', () => {
    it('crea la cuenta, inicia la sesión y guarda el consentimiento con fecha', async () => {
      const respuesta = await request(app).post('/api/auth/registro').send(datosRegistro({ quiereSerTutor: true }))
      assert.equal(respuesta.status, 201)
      assert.ok(respuesta.body.token)
      const { usuario } = respuesta.body
      assert.equal(usuario.tipo, 'ESTUDIANTE')
      assert.equal(usuario.correoInstitucional, 'hernan.pimienta@uniguajira.edu.co')
      assert.equal(usuario.programa.nombre, 'Ingeniería de Sistemas')
      assert.equal(usuario.quiereSerTutor, true)
      assert.equal(usuario.perfilTutor, null)
      assert.equal(usuario.consentimientoDatos.aceptado, true)
      assert.ok(!Number.isNaN(Date.parse(usuario.consentimientoDatos.fecha)))
    })

    it('guarda la contraseña cifrada con bcrypt y nunca la devuelve', async () => {
      const respuesta = await request(app).post('/api/auth/registro').send(datosRegistro())
      assert.doesNotMatch(JSON.stringify(respuesta.body), /clave/i)
      const guardado = await Usuario.findOne({ correoInstitucional: 'hernan.pimienta@uniguajira.edu.co' }).select('+claveHash')
      assert.match(guardado.claveHash, /^\$2[aby]\$/)
      assert.notEqual(guardado.claveHash, 'ClaveNueva2026')
    })

    it('rechaza con 400 un correo que no es del dominio institucional', async () => {
      for (const correoInstitucional of ['hernan@gmail.com', 'hernan@uniguajira.edu.co.co', 'hernan@otra.uniguajira.edu.co', 'sin-arroba']) {
        const respuesta = await request(app).post('/api/auth/registro').send(datosRegistro({ correoInstitucional }))
        assert.equal(respuesta.status, 400, correoInstitucional)
        assert.ok(respuesta.body.errores.some((error) => /institucional/.test(error)))
      }
      assert.equal(await Usuario.countDocuments(), 7)
    })

    it('rechaza con 400 si no se acepta el tratamiento de datos', async () => {
      for (const aceptaTratamientoDatos of [false, undefined, 'true']) {
        const respuesta = await request(app).post('/api/auth/registro').send(datosRegistro({ aceptaTratamientoDatos }))
        assert.equal(respuesta.status, 400)
        assert.ok(respuesta.body.errores.some((error) => /tratamiento/.test(error)))
      }
    })

    it('rechaza con 400 una contraseña débil', async () => {
      for (const clave of ['corta1', 'sololetrasss', '1234567890', 'a1'.repeat(40)]) {
        const respuesta = await request(app).post('/api/auth/registro').send(datosRegistro({ clave }))
        assert.equal(respuesta.status, 400, clave)
      }
    })

    it('el tope de la contraseña es de 72 bytes, no de 72 caracteres, y el mensaje lo dice', async () => {
      // 38 caracteres que ocupan 74 bytes: cada é son 2 bytes.
      const respuesta = await request(app).post('/api/auth/registro').send(datosRegistro({ clave: 'A1' + 'é'.repeat(36) }))
      assert.equal(respuesta.status, 400)
      assert.match(respuesta.body.errores[0], /72 bytes/)
    })

    it('lista todos los errores cuando faltan datos', async () => {
      const respuesta = await request(app).post('/api/auth/registro').send({})
      assert.equal(respuesta.status, 400)
      assert.equal(respuesta.body.errores.length, 7)
    })

    it('rechaza con 400 un programa que no existe y un semestre fuera de rango', async () => {
      const sinPrograma = await request(app).post('/api/auth/registro').send(datosRegistro({ programa: '6728f1a2b3c4d5e6f7a8b9c0' }))
      assert.equal(sinPrograma.status, 400)
      const semestre = await request(app).post('/api/auth/registro').send(datosRegistro({ semestre: 11 }))
      assert.equal(semestre.status, 400)
    })

    it('rechaza con 409 un correo que ya tiene cuenta', async () => {
      const respuesta = await request(app).post('/api/auth/registro').send(datosRegistro({ correoInstitucional: CORREO_ESTUDIANTE.toUpperCase() }))
      assert.equal(respuesta.status, 409)
    })

    it('ignora los campos que no le corresponden: nadie se registra como administrador', async () => {
      const respuesta = await request(app).post('/api/auth/registro').send(datosRegistro({ tipo: 'ADMINISTRADOR', dependencia: 'Rectoría' }))
      assert.equal(respuesta.status, 201)
      assert.equal(respuesta.body.usuario.tipo, 'ESTUDIANTE')
      assert.equal(respuesta.body.usuario.dependencia, undefined)
    })
  })

  describe('POST /api/auth/ingreso', () => {
    it('inicia sesión con correo y contraseña correctos', async () => {
      const respuesta = await ingresar(CORREO_ESTUDIANTE)
      assert.equal(respuesta.status, 200)
      assert.ok(respuesta.body.token)
      assert.equal(respuesta.body.usuario.nombre, 'Elena Lozano')
      assert.doesNotMatch(JSON.stringify(respuesta.body), /clave/i)
    })

    it('responde 401 con el mismo mensaje si la contraseña es incorrecta o el correo no existe', async () => {
      const claveMala = await ingresar(CORREO_ESTUDIANTE, 'OtraClave123')
      const correoInexistente = await ingresar('nadie@uniguajira.edu.co', 'OtraClave123')
      assert.equal(claveMala.status, 401)
      assert.equal(correoInexistente.status, 401)
      assert.deepEqual(claveMala.body, correoInexistente.body)
    })

    it('no acepta la contraseña correcta seguida de más texto (límite de 72 bytes de bcrypt)', async () => {
      // 72 bytes exactos: una con solo caracteres de un byte y otra con caracteres de dos bytes (ñ).
      const claves = ['A1' + 'a'.repeat(70), 'A1' + 'ñ'.repeat(35)]
      for (const [indice, clave] of claves.entries()) {
        assert.equal(Buffer.byteLength(clave, 'utf8'), 72)
        const correoInstitucional = `limite${indice}@uniguajira.edu.co`
        const registro = await request(app).post('/api/auth/registro').send(datosRegistro({ correoInstitucional, clave }))
        assert.equal(registro.status, 201)

        assert.equal((await ingresar(correoInstitucional, clave)).status, 200)
        for (const sufijo of ['distinta', 'x', 'ñ']) {
          const respuesta = await ingresar(correoInstitucional, clave + sufijo)
          assert.equal(respuesta.status, 401, `clave ${indice} con sufijo ${sufijo}`)
          assert.equal(respuesta.body.token, undefined)
        }
        // Cambiar un carácter dentro de los 72 bytes también falla.
        assert.equal((await ingresar(correoInstitucional, 'B1' + clave.slice(2))).status, 401)
      }
    })

    it('rechaza con 400 un cuerpo sin correo o sin contraseña', async () => {
      const respuesta = await request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO_ESTUDIANTE })
      assert.equal(respuesta.status, 400)
    })

    it('rechaza con 400 un intento de inyección de operadores en lugar de texto', async () => {
      const respuesta = await request(app)
        .post('/api/auth/ingreso')
        .send({ correoInstitucional: { $ne: null }, clave: { $ne: null } })
      assert.equal(respuesta.status, 400)
    })

    it('bloquea con 429 después de 5 intentos fallidos seguidos', async () => {
      for (let intento = 0; intento < 5; intento += 1) {
        assert.equal((await ingresar(CORREO_ESTUDIANTE, 'OtraClave123')).status, 401)
      }
      const bloqueado = await ingresar(CORREO_ESTUDIANTE)
      assert.equal(bloqueado.status, 429)
      assert.ok(Number(bloqueado.headers['retry-after']) > 0)
      // El bloqueo es por correo: otra cuenta sigue entrando.
      assert.equal((await ingresar(CORREO_ADMINISTRADOR)).status, 200)
    })
  })

  describe('GET /api/auth/yo', () => {
    it('devuelve la cuenta del token, con programa y resumen del perfil de tutor', async () => {
      const { body } = await ingresar('andrea.salcedo@uniguajira.edu.co')
      const respuesta = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${body.token}`)
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.usuario.nombre, 'Andrea Salcedo')
      assert.equal(respuesta.body.usuario.programa.nombre, 'Ingeniería de Sistemas')
      assert.equal(respuesta.body.usuario.perfilTutor.estadoVerificacion, 'VERIFICADO')
      assert.doesNotMatch(JSON.stringify(respuesta.body), /clave/i)
    })

    it('funciona para el administrador', async () => {
      const { body } = await ingresar(CORREO_ADMINISTRADOR)
      const respuesta = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${body.token}`)
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.usuario.tipo, 'ADMINISTRADOR')
      assert.equal(respuesta.body.usuario.perfilTutor, null)
    })

    it('responde 401 sin token, con un token mal formado o con otro esquema', async () => {
      assert.equal((await request(app).get('/api/auth/yo')).status, 401)
      assert.equal((await request(app).get('/api/auth/yo').set('Authorization', 'Bearer no-es-un-token')).status, 401)
      const { body } = await ingresar(CORREO_ESTUDIANTE)
      assert.equal((await request(app).get('/api/auth/yo').set('Authorization', `Basic ${body.token}`)).status, 401)
    })

    it('responde 401 con un token firmado con otro secreto', async () => {
      const usuario = await Usuario.findOne({ correoInstitucional: CORREO_ESTUDIANTE })
      const falso = jwt.sign({ rol: 'ADMINISTRADOR' }, 'otro-secreto-que-no-es-el-de-la-api', { subject: usuario.id, expiresIn: '1h' })
      const respuesta = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${falso}`)
      assert.equal(respuesta.status, 401)
    })

    it('responde 401 con un token vencido', async () => {
      const usuario = await Usuario.findOne({ correoInstitucional: CORREO_ESTUDIANTE })
      const vencido = jwt.sign({ rol: usuario.tipo }, env.jwtSecreto, { subject: usuario.id, expiresIn: -10 })
      const respuesta = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${vencido}`)
      assert.equal(respuesta.status, 401)
      assert.match(respuesta.body.mensaje, /expiró/)
    })

    it('responde 401 si la cuenta del token ya no existe', async () => {
      const { body } = await ingresar(CORREO_ESTUDIANTE)
      await Usuario.deleteOne({ correoInstitucional: CORREO_ESTUDIANTE })
      const respuesta = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${body.token}`)
      assert.equal(respuesta.status, 401)
    })

    it('el token caduca: lleva fecha de expiración', async () => {
      const { body } = await ingresar(CORREO_ESTUDIANTE)
      const contenido = jwt.decode(body.token)
      assert.ok(contenido.exp > contenido.iat)
      assert.deepEqual(Object.keys(contenido).sort(), ['exp', 'iat', 'rol', 'sub'])
    })
  })

  describe('Documentación', () => {
    it('las respuestas reales de registro, ingreso y cuenta propia cumplen el esquema publicado en Swagger', async () => {
      const registro = await request(app).post('/api/auth/registro').send(datosRegistro())
      await afirmarContrato(registro, '/auth/registro', 'post')
      await afirmarContrato(await request(app).post('/api/auth/registro').send({}), '/auth/registro', 'post')
      await afirmarContrato(await request(app).post('/api/auth/registro').send(datosRegistro()), '/auth/registro', 'post')

      for (const correo of [CORREO_ESTUDIANTE, 'andrea.salcedo@uniguajira.edu.co', CORREO_ADMINISTRADOR]) {
        const ingreso = await ingresar(correo)
        await afirmarContrato(ingreso, '/auth/ingreso', 'post')
        const propio = await request(app).get('/api/auth/yo').set('Authorization', 'Bearer ' + ingreso.body.token)
        await afirmarContrato(propio, '/auth/yo', 'get')
      }

      await afirmarContrato(await ingresar(CORREO_ESTUDIANTE, 'OtraClave123'), '/auth/ingreso', 'post')
      await afirmarContrato(await request(app).post('/api/auth/ingreso').send({}), '/auth/ingreso', 'post')
      await afirmarContrato(await request(app).get('/api/auth/yo'), '/auth/yo', 'get')
    })
  })

  describe('Permisos por rol', () => {
    // Aplicación mínima con los mismos middlewares de la API y una ruta solo para administradores.
    const appDePrueba = express()
    appDePrueba.get('/solo-administrador', autenticar, exigirRol('ADMINISTRADOR'), (_req, res) => res.json({ ok: true }))
    appDePrueba.use(manejarErrores)

    it('un estudiante recibe 403 en una ruta de administrador', async () => {
      const { body } = await ingresar(CORREO_ESTUDIANTE)
      const respuesta = await request(appDePrueba).get('/solo-administrador').set('Authorization', `Bearer ${body.token}`)
      assert.equal(respuesta.status, 403)
      assert.match(respuesta.body.mensaje, /permiso/)
    })

    it('el administrador entra y sin token se responde 401', async () => {
      const { body } = await ingresar(CORREO_ADMINISTRADOR)
      const conToken = await request(appDePrueba).get('/solo-administrador').set('Authorization', `Bearer ${body.token}`)
      assert.equal(conToken.status, 200)
      assert.equal((await request(appDePrueba).get('/solo-administrador')).status, 401)
    })

    it('el rol sale de la base de datos, no de lo que diga el token', async () => {
      const estudiante = await Usuario.findOne({ correoInstitucional: CORREO_ESTUDIANTE })
      const alterado = jwt.sign({ rol: 'ADMINISTRADOR' }, env.jwtSecreto, { subject: estudiante.id, expiresIn: '1h' })
      const respuesta = await request(appDePrueba).get('/solo-administrador').set('Authorization', `Bearer ${alterado}`)
      assert.equal(respuesta.status, 403)
    })
  })
})
