import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { after, before, beforeEach, describe, it } from 'node:test'
import bcrypt from 'bcryptjs'
import { Administrador, Materia, PerfilTutor, Sesion, Usuario } from '../src/models/index.js'
import { cargarSemilla } from '../src/services/semilla.service.js'

describe('E1 · Datos de demostración (seed)', () => {
  before(iniciarBaseDePrueba)
  beforeEach(vaciarBaseDePrueba)
  after(detenerBaseDePrueba)

  it('carga programas, materias, cuentas, perfiles y sesiones', async () => {
    const totales = await cargarSemilla(CLAVE_DE_PRUEBA)
    assert.deepEqual(totales, { programas: 4, materias: 32, usuarios: 7, perfilesTutor: 4, sesiones: 5 })
  })

  it('se puede correr dos veces sin duplicar nada', async () => {
    const primera = await cargarSemilla(CLAVE_DE_PRUEBA)
    const segunda = await cargarSemilla(CLAVE_DE_PRUEBA)
    assert.deepEqual(segunda, primera)
  })

  it('restaura los datos de demostración que se hayan modificado', async () => {
    await cargarSemilla(CLAVE_DE_PRUEBA)
    await Materia.updateOne({ codigo: 'SIS-04' }, { nombre: 'Nombre cambiado', activa: false })
    await cargarSemilla(CLAVE_DE_PRUEBA)
    const materia = await Materia.findOne({ codigo: 'SIS-04' })
    assert.equal(materia.nombre, 'Algoritmo y Programación I')
    assert.equal(materia.activa, true)
  })

  it('guarda las contraseñas cifradas con bcrypt, nunca en texto', async () => {
    await cargarSemilla(CLAVE_DE_PRUEBA)
    const usuarios = await Usuario.find().select('+claveHash')
    for (const usuario of usuarios) {
      assert.notEqual(usuario.claveHash, CLAVE_DE_PRUEBA)
      assert.match(usuario.claveHash, /^\$2[aby]\$/)
    }
    assert.equal(await bcrypt.compare(CLAVE_DE_PRUEBA, usuarios[0].claveHash), true)
    assert.equal(await bcrypt.compare('OtraClave123', usuarios[0].claveHash), false)
  })

  it('deja un administrador, tres tutores verificados y uno pendiente', async () => {
    await cargarSemilla(CLAVE_DE_PRUEBA)
    assert.equal(await Administrador.countDocuments(), 1)
    assert.equal(await PerfilTutor.countDocuments({ estadoVerificacion: 'VERIFICADO' }), 3)
    assert.equal(await PerfilTutor.countDocuments({ estadoVerificacion: 'PENDIENTE' }), 1)
  })

  it('deja una sesión en cada estado del ciclo y una calificada', async () => {
    await cargarSemilla(CLAVE_DE_PRUEBA)
    const estados = (await Sesion.find()).map((sesion) => sesion.estado).sort()
    assert.deepEqual(estados, ['CANCELADA', 'CONFIRMADA', 'FINALIZADA', 'FINALIZADA', 'PENDIENTE'])
    assert.equal(await Sesion.countDocuments({ 'calificacion.puntaje': 5 }), 1)
  })

  it('rechaza una contraseña de demostración débil', async () => {
    await assert.rejects(cargarSemilla('123'), /CLAVE_DEMO/)
    assert.equal(await Usuario.countDocuments(), 0)
  })
})

/** Doble de la conexión y de la carga: registra cada llamada para comprobar qué se intentó. */
function crearDoble() {
  const llamadas = []
  const registrar = (nombre, resultado) => async (...args) => {
    llamadas.push(nombre)
    return resultado ?? args[0]
  }
  return {
    llamadas,
    conexion: {
      conectarBaseDeDatos: registrar('conectarBaseDeDatos'),
      conectarBaseEnMemoria: registrar('conectarBaseEnMemoria'),
      desconectarBaseDeDatos: registrar('desconectarBaseDeDatos'),
      asegurarIndices: registrar('asegurarIndices'),
      cargarSemilla: registrar('cargarSemilla', { programas: 0 }),
    },
  }
}

const SILENCIO = { log() {}, error() {} }

describe('D01 · El seed no corre en producción', () => {
  it('en producción termina con salida 1 y no intenta conectarse a Mongo', async () => {
    const { ejecutar } = await import('../src/scripts/seed.js')
    const { llamadas, conexion } = crearDoble()
    const salidas = []
    await ejecutar({
      configuracion: { esProduccion: true, mongodbUri: 'mongodb://127.0.0.1:1/conectatutor_pruebas', claveDemo: CLAVE_DE_PRUEBA },
      revisar: () => [],
      conexion,
      salir: (codigo) => salidas.push(codigo),
      registro: SILENCIO,
    })
    assert.deepEqual(salidas, [1])
    assert.deepEqual(llamadas, [])
  })

  it('en producción sale con 1 aunque la configuración tenga errores, sin conectarse', async () => {
    const { ejecutar } = await import('../src/scripts/seed.js')
    const { llamadas, conexion } = crearDoble()
    const salidas = []
    await ejecutar({
      configuracion: { esProduccion: true, mongodbUri: '', claveDemo: '' },
      revisar: () => ['Falta algo'],
      conexion,
      salir: (codigo) => salidas.push(codigo),
      registro: SILENCIO,
    })
    assert.deepEqual(salidas, [1])
    assert.deepEqual(llamadas, [])
  })

  it('en un proceso de producción no conecta aunque reciba una configuración de desarrollo', () => {
    const programa = `
      const { ejecutar } = await import('./src/scripts/seed.js')
      const llamadas = []
      const anotar = (n) => async () => { llamadas.push(n) }
      await ejecutar({
        configuracion: { esProduccion: false, mongodbUri: 'mongodb://127.0.0.1:1/conectatutor_pruebas', claveDemo: 'x' },
        revisar: () => [],
        conexion: { conectarBaseDeDatos: anotar('c'), conectarBaseEnMemoria: anotar('m'), desconectarBaseDeDatos: anotar('d'), asegurarIndices: anotar('i'), cargarSemilla: anotar('s') },
        salir: (codigo) => { process.exitCode = codigo },
        registro: { log() {}, error() {} },
      })
      console.log(JSON.stringify(llamadas))
    `
    const resultado = spawnSync(process.execPath, ['--input-type=module', '-e', programa], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', MONGODB_URI: 'mongodb://127.0.0.1:1/conectatutor_pruebas', JWT_SECRETO: 'secreto-sintetico-de-prueba-xxxxxxxxxxxx' },
    })
    assert.equal(resultado.status, 1, resultado.stderr)
    assert.equal(resultado.stdout.trim(), '[]')
  })

  it('en desarrollo sin MONGODB_URI sigue cargando la semilla sobre una base en memoria', async () => {
    const { ejecutar } = await import('../src/scripts/seed.js')
    const { llamadas, conexion } = crearDoble()
    const salidas = []
    await ejecutar({
      configuracion: { esProduccion: false, mongodbUri: '', claveDemo: CLAVE_DE_PRUEBA },
      revisar: () => [],
      conexion,
      salir: (codigo) => salidas.push(codigo),
      registro: SILENCIO,
    })
    assert.deepEqual(salidas, [])
    assert.deepEqual(llamadas, ['conectarBaseEnMemoria', 'asegurarIndices', 'cargarSemilla', 'cargarSemilla', 'desconectarBaseDeDatos'])
  })

  it('en desarrollo con una base local sigue usando la URI indicada', async () => {
    const { ejecutar } = await import('../src/scripts/seed.js')
    const { llamadas, conexion } = crearDoble()
    await ejecutar({
      configuracion: { esProduccion: false, mongodbUri: 'mongodb://127.0.0.1:27017/conectatutor_pruebas', claveDemo: CLAVE_DE_PRUEBA },
      revisar: () => [],
      conexion,
      salir: () => {},
      registro: SILENCIO,
    })
    assert.deepEqual(llamadas, ['conectarBaseDeDatos', 'asegurarIndices', 'cargarSemilla', 'desconectarBaseDeDatos'])
  })
})
