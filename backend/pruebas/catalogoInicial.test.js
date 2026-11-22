import { detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { after, before, beforeEach, describe, it } from 'node:test'
import { MATERIAS, PROGRAMAS } from '../src/datos/catalogoUniguajira.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { Materia, Programa, Usuario } from '../src/models/index.js'
import { cargarCatalogoInicial } from '../src/services/catalogoInicial.service.js'
import { ejecutar } from '../src/scripts/cargarCatalogo.js'
import { MATERIAS as MATERIAS_SEMILLA, PROGRAMAS as PROGRAMAS_SEMILLA } from '../src/scripts/datosSemilla.js'
import { ejecutarAislado } from './ayudas/procesoAislado.js'

function registroFalso() {
  const lineas = []
  const anotar = (...partes) => lineas.push(partes.join(' '))
  return { lineas, log: anotar, error: anotar, texto: () => lineas.join('\n') }
}

/** Contenido exacto del catálogo, para comprobar que una carga no cambió nada. */
async function catalogoGuardado() {
  return {
    programas: await Programa.find().sort({ _id: 1 }).lean(),
    materias: await Materia.find().sort({ _id: 1 }).lean(),
  }
}

describe('D05 · Catálogo académico inicial', () => {
  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    reiniciarIntentos()
  })
  after(detenerBaseDePrueba)

  it('la semilla de demostración usa el mismo catálogo', () => {
    assert.equal(PROGRAMAS_SEMILLA, PROGRAMAS)
    assert.equal(MATERIAS_SEMILLA, MATERIAS)
  })

  it('D06 · trae los 36 programas del formulario, sin repetir, y cada materia apunta a uno de ellos', () => {
    const nombres = PROGRAMAS.map((programa) => programa.nombre)
    assert.equal(nombres.length, 36)
    assert.equal(new Set(nombres).size, 36)
    for (const programa of PROGRAMAS) assert.match(programa.facultad, /^Facultad de /)
    for (const materia of MATERIAS) assert.ok(nombres.includes(materia.programa), materia.programa)
  })

  it('en una base vacía carga todos los programas y materias, activas y en su programa, sin crear cuentas', async () => {
    const resultado = await cargarCatalogoInicial()
    assert.deepEqual(resultado, {
      programas: { creados: PROGRAMAS.length, existentes: 0 },
      materias: { creadas: MATERIAS.length, existentes: 0 },
    })
    assert.equal(await Programa.countDocuments(), PROGRAMAS.length)
    assert.equal(await Materia.countDocuments(), MATERIAS.length)
    for (const { codigo, nombre, programa } of MATERIAS) {
      const materia = await Materia.findOne({ codigo }).populate('programa').lean()
      assert.equal(materia.nombre, nombre)
      assert.equal(materia.programa.nombre, programa)
      assert.equal(materia.activa, true)
    }
    assert.equal(await Usuario.countDocuments(), 0)
  })

  it('una segunda carga no duplica ni cambia nada', async () => {
    await cargarCatalogoInicial()
    const antes = await catalogoGuardado()
    assert.deepEqual(await cargarCatalogoInicial(), {
      programas: { creados: 0, existentes: PROGRAMAS.length },
      materias: { creadas: 0, existentes: MATERIAS.length },
    })
    assert.deepEqual(await catalogoGuardado(), antes)
  })

  it('respeta lo que Coordinación cambió y solo repone lo que falta', async () => {
    await cargarCatalogoInicial()
    await Materia.updateOne({ codigo: 'SIS-01' }, { nombre: 'Cálculo I (editada)', activa: false })
    await Programa.updateOne({ nombre: 'Biología' }, { facultad: 'Facultad editada' })
    await Materia.deleteOne({ codigo: 'PSI-08' })
    const editado = await catalogoGuardado()

    assert.deepEqual(await cargarCatalogoInicial(), {
      programas: { creados: 0, existentes: PROGRAMAS.length },
      materias: { creadas: 1, existentes: MATERIAS.length - 1 },
    })
    const despues = await catalogoGuardado()
    assert.deepEqual(despues.programas, editado.programas)
    // Las materias que ya estaban quedan exactamente igual; solo aparece la que faltaba
    assert.deepEqual(despues.materias.filter(({ codigo }) => codigo !== 'PSI-08'), editado.materias)
    assert.equal(despues.materias.length, MATERIAS.length)
    const sis01 = await Materia.findOne({ codigo: 'SIS-01' }).lean()
    assert.equal(sis01.nombre, 'Cálculo I (editada)')
    assert.equal(sis01.activa, false)
  })

  it('dos cargas al mismo tiempo dejan el catálogo una sola vez', async () => {
    const resultados = await Promise.all([cargarCatalogoInicial(), cargarCatalogoInicial()])
    assert.equal(resultados.reduce((total, { programas }) => total + programas.creados, 0), PROGRAMAS.length)
    assert.equal(resultados.reduce((total, { materias }) => total + materias.creadas, 0), MATERIAS.length)
    assert.equal(await Programa.countDocuments(), PROGRAMAS.length)
    assert.equal(await Materia.countDocuments(), MATERIAS.length)
  })

  it('en producción, desde una base vacía: catálogo, primera Coordinación, y Coordinación crea una materia y un estudiante', async () => {
    const { host, port, name } = mongoose.connection
    const entorno = { NODE_ENV: 'production', MONGODB_URI: `mongodb://${host}:${port}/${name}` }
    const catalogo = ejecutarAislado(`
      const { ejecutar } = await import(new URL('src/scripts/cargarCatalogo.js', process.env.RAIZ_BACKEND))
      process.exitCode = await ejecutar()
    `, entorno, { tope: 60000 })
    assert.equal(catalogo.status, 0, catalogo.stderr)
    assert.match(catalogo.stdout, new RegExp(`Programas: ${PROGRAMAS.length} creados, 0 ya estaban`))
    assert.match(catalogo.stdout, new RegExp(`Materias: ${MATERIAS.length} creadas, 0 ya estaban`))

    const clave = 'ClaveInicial2026'
    const correo = 'coordinacion.inicial@uniguajira.edu.co'
    const coordinacion = ejecutarAislado(`
      const { ejecutar } = await import(new URL('src/scripts/crearCoordinacion.js', process.env.RAIZ_BACKEND))
      process.exitCode = await ejecutar()
    `, { ...entorno, COORDINACION_NOMBRE: 'Coordinadora Inicial', COORDINACION_CORREO: correo, COORDINACION_CLAVE: clave }, { tope: 60000 })
    assert.equal(coordinacion.status, 0, coordinacion.stderr)

    // La base no recibió cuentas ni sesiones de demostración: solo la de Coordinación
    assert.equal(await Usuario.countDocuments(), 1)
    assert.equal(await mongoose.connection.db.collection('sesiones').countDocuments(), 0)

    // La API arrancada como producción, en su propio proceso y conectada solo a la base temporal:
    // Coordinación ingresa, ve los programas y crea una materia y la cuenta de un estudiante
    const api = ejecutarAislado(`
      const raiz = process.env.RAIZ_BACKEND
      const supertest = (await import(process.env.SUPERTEST)).default
      const { conectarBaseDeDatos, desconectarBaseDeDatos } = await import(raiz + 'src/config/database.js')
      const { env } = await import(raiz + 'src/config/env.js')
      const { asegurarIndices } = await import(raiz + 'src/models/index.js')
      const { app } = await import(raiz + 'src/app.js')
      await conectarBaseDeDatos(process.env.MONGODB_URI)
      await asegurarIndices()
      try {
        const ingreso = await supertest(app).post('/api/auth/ingreso').send({ correoInstitucional: process.env.CORREO, clave: process.env.CLAVE })
        const programas = await supertest(app).get('/api/programas')
        const sistemas = (programas.body ?? []).find(({ nombre }) => nombre === 'Ingeniería de Sistemas')
        const autorizacion = 'Bearer ' + ingreso.body.token
        const materia = await supertest(app).post('/api/materias').set('Authorization', autorizacion)
          .send({ codigo: 'SIS-99', nombre: 'Bases de Datos I', programa: sistemas?.id })
        const cuenta = await supertest(app).post('/api/coordinacion/cuentas').set('Authorization', autorizacion)
          .send({ nombre: 'Laura Pérez', correoInstitucional: 'laura.perez@uniguajira.edu.co', documento: '1122334455', semestre: 1, sede: 'Riohacha', programa: sistemas?.id })
        const registro = await supertest(app).post('/api/auth/registro').send({})
        console.log(JSON.stringify({
          produccion: env.esProduccion,
          ingreso: ingreso.status, programas: programas.status, totalProgramas: programas.body.length,
          materia: materia.status, cuenta: cuenta.status, registro: registro.status,
        }))
      } finally {
        await desconectarBaseDeDatos()
      }
    `, { ...entorno, CORREO: correo, CLAVE: clave }, { tope: 60000 })
    assert.equal(api.status, 0, api.stderr)
    assert.deepEqual(JSON.parse(api.stdout.trim().split('\n').at(-1)), {
      produccion: true,
      ingreso: 200, programas: 200, totalProgramas: PROGRAMAS.length,
      materia: 201, cuenta: 201, registro: 404,
    })
    assert.ok(await Materia.exists({ codigo: 'SIS-99' }))
    assert.equal((await Usuario.findOne({ correoInstitucional: 'laura.perez@uniguajira.edu.co' })).tipo, 'ESTUDIANTE')

    // Repetir la carga en producción no toca lo que ya existe, incluida la materia nueva
    const repetida = ejecutarAislado(`
      const { ejecutar } = await import(new URL('src/scripts/cargarCatalogo.js', process.env.RAIZ_BACKEND))
      process.exitCode = await ejecutar()
    `, entorno, { tope: 60000 })
    assert.equal(repetida.status, 0, repetida.stderr)
    assert.match(repetida.stdout, /Programas: 0 creados/)
    assert.equal(await Materia.countDocuments(), MATERIAS.length + 1)
  })

  it('el comando no toca otras colecciones: no migra sesiones antiguas ni crea sus índices', async () => {
    const { host, port } = mongoose.connection
    const nombre = 'conectatutor_catalogo_sin_tocar'
    const otraBase = mongoose.connection.client.db(nombre)
    await otraBase.dropDatabase()
    try {
      // Una sesión antigua sin `minutosOcupados` y una cuenta, tal como estarían en la base
      const sesion = { _id: new mongoose.Types.ObjectId(), estado: 'PENDIENTE', franja: { horaInicio: '08:00', horaFin: '10:00' } }
      const usuario = { _id: new mongoose.Types.ObjectId(), correoInstitucional: 'cuenta.previa@uniguajira.edu.co', tipo: 'ESTUDIANTE' }
      await otraBase.collection('sesiones').insertOne(sesion)
      await otraBase.collection('usuarios').insertOne(usuario)

      const carga = ejecutarAislado(`
        const { ejecutar } = await import(new URL('src/scripts/cargarCatalogo.js', process.env.RAIZ_BACKEND))
        process.exitCode = await ejecutar()
      `, { NODE_ENV: 'production', MONGODB_URI: `mongodb://${host}:${port}/${nombre}` }, { tope: 60000 })
      assert.equal(carga.status, 0, carga.stderr)

      assert.deepEqual(await otraBase.collection('sesiones').find().toArray(), [sesion])
      assert.deepEqual(await otraBase.collection('usuarios').find().toArray(), [usuario])
      for (const coleccion of ['sesiones', 'usuarios']) {
        const indices = (await otraBase.collection(coleccion).indexes()).map(({ name }) => name)
        assert.deepEqual(indices, ['_id_'], `${coleccion} conserva solo sus índices de antes`)
      }
      const colecciones = (await otraBase.listCollections().toArray()).map(({ name }) => name).sort()
      assert.deepEqual(colecciones, ['materias', 'programas', 'sesiones', 'usuarios'])
      assert.equal(await otraBase.collection('materias').countDocuments(), MATERIAS.length)
    } finally {
      await otraBase.dropDatabase()
    }
  })
})

describe('D05 · Script cargar-catalogo sin base real', () => {
  const conexionFalsa = ({ falla } = {}) => {
    const llamadas = []
    return {
      llamadas,
      conectarBaseDeDatos: async (uri) => { llamadas.push(`conectar ${uri}`) },
      asegurarIndices: async () => { llamadas.push('indices') },
      cargarCatalogoInicial: async () => {
        llamadas.push('cargar')
        if (falla) throw new Error(falla)
        return { programas: { creados: 4, existentes: 0 }, materias: { creadas: 30, existentes: 2 } }
      },
      desconectarBaseDeDatos: async () => { llamadas.push('desconectar') },
    }
  }

  it('sin MONGODB_URI termina con 1 sin conectarse', async () => {
    const conexion = conexionFalsa()
    const registro = registroFalso()
    assert.equal(await ejecutar({ configuracion: { mongodbUri: '' }, conexion, registro }), 1)
    assert.deepEqual(conexion.llamadas, [])
    assert.match(registro.texto(), /Falta MONGODB_URI/)
  })

  it('crea los índices antes de cargar, informa lo creado y cierra la conexión', async () => {
    const conexion = conexionFalsa()
    const registro = registroFalso()
    assert.equal(await ejecutar({ configuracion: { mongodbUri: 'mongodb://127.0.0.1:1/x' }, conexion, registro }), 0)
    assert.deepEqual(conexion.llamadas, ['conectar mongodb://127.0.0.1:1/x', 'indices', 'cargar', 'desconectar'])
    assert.match(registro.texto(), /Programas: 4 creados, 0 ya estaban/)
    assert.match(registro.texto(), /Materias: 30 creadas, 2 ya estaban/)
  })

  it('si la carga falla termina con 1 y cierra la conexión', async () => {
    const conexion = conexionFalsa({ falla: 'sin conexión' })
    const registro = registroFalso()
    assert.equal(await ejecutar({ configuracion: { mongodbUri: 'mongodb://127.0.0.1:1/x' }, conexion, registro }), 1)
    assert.equal(conexion.llamadas.at(-1), 'desconectar')
    assert.match(registro.texto(), /No se pudo cargar el catálogo: sin conexión/)
  })
})
