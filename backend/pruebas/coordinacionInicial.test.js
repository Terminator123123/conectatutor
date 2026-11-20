import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import mongoose from 'mongoose'
import { after, before, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { INSTITUCION } from '../src/config/institucion.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { Usuario } from '../src/models/index.js'
import { crearCoordinacionInicial, ID_COORDINACION_INICIAL } from '../src/services/coordinacionInicial.service.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { ejecutar, leerClaveOculta } from '../src/scripts/crearCoordinacion.js'
import { ejecutarAislado } from './ayudas/procesoAislado.js'

const DATOS = { nombre: 'Coordinadora Inicial', correo: 'coordinacion.inicial@uniguajira.edu.co', clave: 'ClaveInicial2026' }
const ENTORNO = { COORDINACION_NOMBRE: DATOS.nombre, COORDINACION_CORREO: DATOS.correo, COORDINACION_CLAVE: DATOS.clave }

function registroFalso() {
  const lineas = []
  const anotar = (...partes) => lineas.push(partes.join(' '))
  return { lineas, log: anotar, error: anotar, texto: () => lineas.join('\n') }
}

/** Conexión de mentira para probar el script sin base: anota qué se llamó y con qué datos. */
function conexionFalsa(resultado = { resultado: 'creada', correo: DATOS.correo }) {
  const llamadas = []
  return {
    llamadas,
    conectarBaseDeDatos: async (uri) => { llamadas.push(['conectar', uri]) },
    asegurarIndices: async () => { llamadas.push(['indices']) },
    crearCoordinacionInicial: async (datos) => { llamadas.push(['crear', datos]); return resultado },
    desconectarBaseDeDatos: async () => { llamadas.push(['desconectar']) },
  }
}

describe('D03 · Primera cuenta de Coordinación', () => {
  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    reiniciarIntentos()
  })
  after(detenerBaseDePrueba)

  it('en una base sin cuentas crea la de Coordinación con la contraseña cifrada, y con ella se ingresa', async () => {
    const creada = await crearCoordinacionInicial({ ...DATOS, correo: '  Coordinacion.Inicial@Uniguajira.edu.co ' })
    assert.deepEqual(creada, { resultado: 'creada', correo: DATOS.correo })
    const guardada = await Usuario.findOne({ correoInstitucional: DATOS.correo }).select('+claveHash')
    assert.equal(guardada.tipo, 'ADMINISTRADOR')
    assert.equal(guardada.nombre, DATOS.nombre)
    assert.equal(guardada.dependencia, INSTITUCION.dependenciaVerificadora)
    assert.match(guardada.claveHash, /^\$2[aby]\$/)
    assert.ok(!guardada.claveHash.includes(DATOS.clave))

    const ingreso = await request(app).post('/api/auth/ingreso').send({ correoInstitucional: DATOS.correo, clave: DATOS.clave })
    assert.equal(ingreso.status, 200)
    assert.equal(ingreso.body.usuario.tipo, 'ADMINISTRADOR')
    // Es una cuenta de Coordinación completa: entra a las rutas de Coordinación
    const perfiles = await request(app).get('/api/coordinacion/perfiles').set('Authorization', `Bearer ${ingreso.body.token}`)
    assert.equal(perfiles.status, 200)
  })

  it('acepta otra dependencia si se indica', async () => {
    await crearCoordinacionInicial({ ...DATOS, dependencia: ' Vicerrectoría Académica ' })
    assert.equal((await Usuario.findOne({ correoInstitucional: DATOS.correo })).dependencia, 'Vicerrectoría Académica')
  })

  it('si ya hay una cuenta de Coordinación no crea otra ni cambia la existente', async () => {
    await cargarSemilla(CLAVE_DE_PRUEBA)
    const antes = await Usuario.find({ tipo: 'ADMINISTRADOR' }).select('+claveHash').lean()
    assert.deepEqual(await crearCoordinacionInicial(DATOS), { resultado: 'ya-existe' })
    assert.deepEqual(await Usuario.find({ tipo: 'ADMINISTRADOR' }).select('+claveHash').lean(), antes)
    assert.equal(await Usuario.exists({ correoInstitucional: DATOS.correo }), null)
  })

  it('no usa el correo de otra cuenta', async () => {
    await cargarSemilla(CLAVE_DE_PRUEBA)
    await Usuario.deleteMany({ tipo: 'ADMINISTRADOR' })
    const elena = 'elena.lozano@uniguajira.edu.co'
    assert.deepEqual(await crearCoordinacionInicial({ ...DATOS, correo: elena }), { resultado: 'correo-en-uso' })
    assert.equal((await Usuario.findOne({ correoInstitucional: elena })).tipo, 'ESTUDIANTE')
    assert.equal(await Usuario.countDocuments({ tipo: 'ADMINISTRADOR' }), 0)
  })

  it('rechaza datos que no cumplen las reglas de las cuentas, sin escribir nada', async () => {
    const invalidos = [
      { nombre: 'Yo' }, { nombre: undefined }, { correo: 'coordinacion@gmail.com' }, { correo: undefined },
      { clave: 'corta1' }, { clave: 'sololetrasaqui' }, { clave: undefined }, { dependencia: '   ' }, { dependencia: 'x'.repeat(161) },
    ]
    for (const cambio of invalidos) {
      const { resultado, problemas } = await crearCoordinacionInicial({ ...DATOS, ...cambio })
      assert.equal(resultado, 'datos-invalidos', JSON.stringify(cambio))
      assert.ok(problemas.length >= 1)
    }
    assert.equal(await Usuario.countDocuments(), 0)
  })

  it('dos altas al mismo tiempo dejan una sola cuenta de Coordinación', async () => {
    const resultados = await Promise.all([
      crearCoordinacionInicial(DATOS),
      crearCoordinacionInicial({ ...DATOS, nombre: 'Otra Coordinadora', correo: 'otra.coordinacion@uniguajira.edu.co' }),
    ])
    assert.deepEqual(resultados.map(({ resultado }) => resultado).sort(), ['creada', 'ya-existe'])
    assert.equal(await Usuario.countDocuments({ tipo: 'ADMINISTRADOR' }), 1)
    assert.ok((await Usuario.findOne({ tipo: 'ADMINISTRADOR' }))._id.equals(ID_COORDINACION_INICIAL))
  })

  it('el script, en un proceso aparte, crea la cuenta en la base indicada sin mostrar la contraseña; la segunda vez no crea otra', () => {
    const { host, port, name } = mongoose.connection
    const programa = `
      const { ejecutar } = await import(new URL('src/scripts/crearCoordinacion.js', process.env.RAIZ_BACKEND))
      process.exitCode = await ejecutar()
    `
    const entorno = { ...ENTORNO, MONGODB_URI: `mongodb://${host}:${port}/${name}` }
    const primera = ejecutarAislado(programa, entorno, { tope: 60000 })
    assert.equal(primera.status, 0, primera.stderr)
    assert.match(primera.stdout, /Cuenta creada para coordinacion\.inicial@uniguajira\.edu\.co/)
    assert.ok(!`${primera.stdout}${primera.stderr}`.includes(DATOS.clave), 'la contraseña no se muestra')

    const segunda = ejecutarAislado(programa, { ...entorno, COORDINACION_CORREO: 'otra.coordinacion@uniguajira.edu.co' }, { tope: 60000 })
    assert.equal(segunda.status, 1)
    assert.match(segunda.stderr, /ya tiene una cuenta de Coordinación/)
    return Usuario.countDocuments({ tipo: 'ADMINISTRADOR' }).then((total) => assert.equal(total, 1))
  })
})

describe('D03 · Script crear-coordinacion sin base real', () => {
  it('sin MONGODB_URI termina con 1 y no se conecta', async () => {
    const conexion = conexionFalsa()
    const registro = registroFalso()
    assert.equal(await ejecutar({ entorno: ENTORNO, configuracion: { mongodbUri: '' }, conexion, registro }), 1)
    assert.deepEqual(conexion.llamadas, [])
    assert.match(registro.texto(), /Falta MONGODB_URI/)
  })

  it('con datos inválidos termina con 1 sin conectarse y sin mostrar la contraseña', async () => {
    const conexion = conexionFalsa()
    const registro = registroFalso()
    const entorno = { ...ENTORNO, COORDINACION_CORREO: 'coordinacion@gmail.com', COORDINACION_CLAVE: 'clave-sin-numeros' }
    assert.equal(await ejecutar({ entorno, configuracion: { mongodbUri: 'mongodb://127.0.0.1:1/x' }, conexion, registro }), 1)
    assert.deepEqual(conexion.llamadas, [])
    assert.ok(!registro.texto().includes('clave-sin-numeros'))
  })

  it('sin COORDINACION_CLAVE pide la contraseña dos veces; si no coinciden no crea nada', async () => {
    const conexion = conexionFalsa()
    const respuestas = ['ClaveUno2026', 'ClaveDos2026']
    const preguntas = []
    const pedirClave = async (pregunta) => { preguntas.push(pregunta); return respuestas.shift() }
    const entorno = { ...ENTORNO, COORDINACION_CLAVE: '' }
    assert.equal(await ejecutar({ entorno, configuracion: { mongodbUri: 'mongodb://127.0.0.1:1/x' }, conexion, pedirClave, registro: registroFalso() }), 1)
    assert.equal(preguntas.length, 2)
    assert.deepEqual(conexion.llamadas, [])
  })

  it('sin terminal y sin COORDINACION_CLAVE termina con 1', async () => {
    const conexion = conexionFalsa()
    const registro = registroFalso()
    const entorno = { COORDINACION_NOMBRE: DATOS.nombre, COORDINACION_CORREO: DATOS.correo }
    assert.equal(await ejecutar({ entorno, configuracion: { mongodbUri: 'mongodb://127.0.0.1:1/x' }, conexion, pedirClave: async () => null, registro }), 1)
    assert.deepEqual(conexion.llamadas, [])
    assert.match(registro.texto(), /COORDINACION_CLAVE/)
  })

  it('con la contraseña pedida crea la cuenta, la pasa al servicio y nunca la escribe en el registro', async () => {
    const conexion = conexionFalsa()
    const registro = registroFalso()
    const entorno = { COORDINACION_NOMBRE: DATOS.nombre, COORDINACION_CORREO: DATOS.correo, COORDINACION_DEPENDENCIA: '' }
    const codigo = await ejecutar({ entorno, configuracion: { mongodbUri: 'mongodb://127.0.0.1:1/x' }, conexion, pedirClave: async () => DATOS.clave, registro })
    assert.equal(codigo, 0)
    assert.deepEqual(conexion.llamadas.map(([paso]) => paso), ['conectar', 'indices', 'crear', 'desconectar'])
    assert.deepEqual(conexion.llamadas[2][1], { nombre: DATOS.nombre, correo: DATOS.correo, clave: DATOS.clave, dependencia: undefined })
    assert.ok(!registro.texto().includes(DATOS.clave))
  })

  // Terminal de mentira: recibe lo que se teclea y guarda lo que se escribe en pantalla
  function terminalFalsa({ esTerminal = true } = {}) {
    const entrada = new EventEmitter()
    Object.assign(entrada, {
      isTTY: esTerminal, crudo: false,
      setRawMode(valor) { this.crudo = valor }, resume() {}, pause() {}, setEncoding() {},
    })
    if (!esTerminal) delete entrada.setRawMode
    const pantalla = []
    return { entrada, salida: { write: (texto) => pantalla.push(texto) }, pantalla }
  }

  it('la contraseña se teclea sin mostrarse, admite borrar y se cancela con Ctrl+C', async () => {
    const { entrada, salida, pantalla } = terminalFalsa()
    const pedida = leerClaveOculta(entrada, salida, 'Contraseña: ')
    assert.equal(entrada.crudo, true)
    entrada.emit('data', 'Clave')
    entrada.emit('data', 'X\b2026\r')
    assert.equal(await pedida, 'Clave2026')
    assert.equal(entrada.crudo, false, 'la terminal vuelve a su modo normal')
    assert.ok(!pantalla.join('').includes('Clave'), 'lo tecleado no aparece en pantalla')

    const cancelada = leerClaveOculta(entrada, salida, 'Contraseña: ')
    entrada.emit('data', 'abc\u0003')
    assert.equal(await cancelada, null)
    assert.equal(entrada.listenerCount('data'), 0)
  })

  it('sin terminal interactiva no pide la contraseña', async () => {
    const { entrada, salida, pantalla } = terminalFalsa({ esTerminal: false })
    assert.equal(await leerClaveOculta(entrada, salida, 'Contraseña: '), null)
    assert.deepEqual(pantalla, [])
  })

  it('si la base ya tiene Coordinación o el correo está en uso termina con 1 y cierra la conexión', async () => {
    for (const resultado of [{ resultado: 'ya-existe' }, { resultado: 'correo-en-uso' }]) {
      const conexion = conexionFalsa(resultado)
      assert.equal(await ejecutar({ entorno: ENTORNO, configuracion: { mongodbUri: 'mongodb://127.0.0.1:1/x' }, conexion, registro: registroFalso() }), 1)
      assert.equal(conexion.llamadas.at(-1)[0], 'desconectar')
    }
  })
})
