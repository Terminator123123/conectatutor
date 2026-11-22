import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import mongoose from 'mongoose'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { reiniciarIntentos } from '../src/middlewares/limitarIntentos.js'
import { Facultad, Materia, Notificacion, PerfilTutor, Programa, Sesion, Usuario } from '../src/models/index.js'
import { COLECCIONES_RESPALDADAS, exportarRespaldo, FORMATO, leerRespaldo, MANIFIESTO } from '../src/services/respaldo.service.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { ejecutar as respaldar } from '../src/scripts/respaldar.js'
import { ejecutar as verificar } from '../src/scripts/verificarRespaldo.js'
import { ejecutarAislado } from './ayudas/procesoAislado.js'

const { EJSON } = mongoose.mongo.BSON
const CORREO = 'elena.lozano@uniguajira.edu.co'
// PNG de 1 × 1 píxel
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/** Contenido exacto de cada colección en EJSON canónico: distingue enteros, decimales, fechas, identificadores e imágenes. */
async function contenidoDeLaBase() {
  const contenido = {}
  for (const nombre of COLECCIONES_RESPALDADAS) {
    // Sin convertir los números: un Long, un Int32 y un Double con el mismo valor deben verse distintos
    const documentos = await mongoose.connection.db
      .collection(nombre)
      .find({}, { sort: { _id: 1 }, promoteLongs: false, promoteValues: false })
      .toArray()
    contenido[nombre] = EJSON.stringify(documentos, { relaxed: false })
  }
  return contenido
}

async function ponerFoto() {
  const { token } = (await request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave: CLAVE_DE_PRUEBA })).body
  assert.equal((await request(app).put('/api/auth/yo/foto').set('Authorization', `Bearer ${token}`).send({ imagen: PNG })).status, 200)
}

function registroFalso() {
  const lineas = []
  const anotar = (...partes) => lineas.push(partes.join(' '))
  return { lineas, log: anotar, error: anotar, texto: () => lineas.join('\n') }
}

describe('D04 · Respaldo de la base (RQNF010)', () => {
  let carpetaBase
  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    reiniciarIntentos()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    carpetaBase = mkdtempSync(path.join(tmpdir(), 'conectatutor-respaldo-'))
  })
  afterEach(() => rmSync(carpetaBase, { recursive: true, force: true }))
  after(detenerBaseDePrueba)

  it('exporta cada colección con un manifiesto que coincide con la base', async () => {
    const { carpeta, colecciones } = await exportarRespaldo({ carpetaBase, fecha: new Date('2026-11-20T07:00:00.123Z') })
    assert.equal(path.basename(carpeta), 'respaldo-2026-11-20T07-00-00Z')
    assert.deepEqual(readdirSync(carpeta).sort(), [...COLECCIONES_RESPALDADAS.map((nombre) => `${nombre}.json`), MANIFIESTO].sort())
    for (const nombre of COLECCIONES_RESPALDADAS) {
      assert.equal(colecciones[nombre], await mongoose.connection.db.collection(nombre).countDocuments(), nombre)
    }
    assert.ok(colecciones.usuarios > 0 && colecciones.sesiones > 0 && colecciones.materias > 0)
    const manifiesto = JSON.parse(readFileSync(path.join(carpeta, MANIFIESTO), 'utf8'))
    assert.deepEqual(manifiesto, { formato: FORMATO, fecha: '2026-11-20T07:00:00.123Z', baseDeDatos: mongoose.connection.name, colecciones })
  })

  it('al restaurarlo la base queda idéntica y las cuentas vuelven a ingresar con su contraseña y su foto', async () => {
    await ponerFoto()
    const antes = await contenidoDeLaBase()
    const { carpeta } = await exportarRespaldo({ carpetaBase })

    await vaciarBaseDePrueba()
    const { documentos } = await leerRespaldo(carpeta)
    for (const [nombre, lista] of Object.entries(documentos)) {
      if (lista.length > 0) await mongoose.connection.db.collection(nombre).insertMany(lista)
    }
    assert.deepEqual(await contenidoDeLaBase(), antes)

    reiniciarIntentos()
    const ingreso = await request(app).post('/api/auth/ingreso').send({ correoInstitucional: CORREO, clave: CLAVE_DE_PRUEBA })
    assert.equal(ingreso.status, 200)
    const foto = await request(app).get(`/api/usuarios/${ingreso.body.usuario.id}/foto`)
    assert.equal(foto.status, 200)
    assert.equal(foto.headers['content-type'], 'image/png')
  })

  it('las colecciones respaldadas son las de los modelos de la aplicación', () => {
    const deLosModelos = [Facultad, Programa, Materia, Usuario, PerfilTutor, Sesion, Notificacion].map((modelo) => modelo.collection.collectionName)
    assert.deepEqual([...COLECCIONES_RESPALDADAS].sort(), deLosModelos.sort())
  })

  it('conserva el tipo BSON de cada número al exportar y al restaurar', async () => {
    const { Long, Int32, Double, Decimal128, ObjectId } = mongoose.mongo.BSON
    const _id = new ObjectId()
    const programas = mongoose.connection.db.collection('programas')
    await programas.insertOne({
      _id,
      largo: Long.fromNumber(7),
      entero: new Int32(7),
      doble: new Double(7),
      decimal: Decimal128.fromString('7'),
      enteroGrande: Long.fromString('9007199254740993'),
    })
    const antes = await contenidoDeLaBase()
    const { carpeta } = await exportarRespaldo({ carpetaBase })

    const linea = readFileSync(path.join(carpeta, 'programas.json'), 'utf8').split('\n').find((texto) => texto.includes(_id.toHexString()))
    assert.match(linea, /"largo":\{"\$numberLong":"7"\}/)
    assert.match(linea, /"entero":\{"\$numberInt":"7"\}/)
    assert.match(linea, /"doble":\{"\$numberDouble":"7\.0"\}/)
    assert.match(linea, /"decimal":\{"\$numberDecimal":"7"\}/)
    assert.match(linea, /"enteroGrande":\{"\$numberLong":"9007199254740993"\}/)

    await vaciarBaseDePrueba()
    const { documentos } = await leerRespaldo(carpeta)
    for (const [nombre, lista] of Object.entries(documentos)) {
      if (lista.length > 0) await mongoose.connection.db.collection(nombre).insertMany(lista)
    }
    assert.deepEqual(await contenidoDeLaBase(), antes)
    // El tipo guardado en la base es el original ($type de MongoDB)
    const tipos = await programas.aggregate([
      { $match: { _id } },
      { $project: { _id: 0, largo: { $type: '$largo' }, entero: { $type: '$entero' }, doble: { $type: '$doble' }, decimal: { $type: '$decimal' } } },
    ]).toArray()
    assert.deepEqual(tipos, [{ largo: 'long', entero: 'int', doble: 'double', decimal: 'decimal' }])
  })

  it('una base vacía también se respalda y se lee', async () => {
    await vaciarBaseDePrueba()
    const { carpeta, colecciones } = await exportarRespaldo({ carpetaBase })
    assert.ok(Object.values(colecciones).every((total) => total === 0))
    assert.ok(Object.values((await leerRespaldo(carpeta)).documentos).every((lista) => lista.length === 0))
  })

  it('nunca sobrescribe un respaldo existente', async () => {
    const fecha = new Date('2026-11-20T07:00:00Z')
    const { carpeta } = await exportarRespaldo({ carpetaBase, fecha })
    const manifiesto = readFileSync(path.join(carpeta, MANIFIESTO), 'utf8')
    await assert.rejects(exportarRespaldo({ carpetaBase, fecha }), { code: 'EEXIST' })
    assert.equal(readFileSync(path.join(carpeta, MANIFIESTO), 'utf8'), manifiesto)
  })

  it('si la exportación falla a medias no deja una carpeta incompleta', async () => {
    const fallaEnUsuarios = {
      name: 'conectatutor_pruebas',
      db: {
        collection: (nombre) => ({
          find: () => ({
            async* [Symbol.asyncIterator]() {
              if (nombre === 'usuarios') throw new Error('fallo simulado de lectura')
            },
          }),
        }),
      },
    }
    await assert.rejects(exportarRespaldo({ carpetaBase, conexion: fallaEnUsuarios }), /fallo simulado de lectura/)
    assert.deepEqual(readdirSync(carpetaBase), [])
  })

  it('la lectura detecta un conteo distinto, un archivo dañado, uno que falta y un manifiesto ajeno', async () => {
    const { carpeta } = await exportarRespaldo({ carpetaBase })
    await leerRespaldo(carpeta)
    const usuarios = path.join(carpeta, 'usuarios.json')
    const lista = EJSON.parse(readFileSync(usuarios, 'utf8'), { relaxed: false })
    writeFileSync(usuarios, EJSON.stringify(lista.slice(1), { relaxed: false }))
    await assert.rejects(leerRespaldo(carpeta), /usuarios\.json tiene \d+ documentos y el manifiesto dice \d+/)
    writeFileSync(usuarios, '[{"_id": ')
    await assert.rejects(leerRespaldo(carpeta), /No se pudo leer usuarios\.json/)
    // El mensaje dice qué archivo falló, pero no copia su contenido (puede tener datos personales)
    writeFileSync(usuarios, '[alumna@example.test]')
    await assert.rejects(leerRespaldo(carpeta), (error) => {
      assert.match(error.message, /No se pudo leer usuarios\.json: el contenido no es EJSON válido/)
      assert.doesNotMatch(error.message, /alumna|example/)
      return true
    })
    writeFileSync(path.join(carpeta, MANIFIESTO + '.copia'), readFileSync(path.join(carpeta, MANIFIESTO)))
    writeFileSync(path.join(carpeta, MANIFIESTO), '{"correo": "alumna@example.test"')
    await assert.rejects(leerRespaldo(carpeta), (error) => {
      assert.match(error.message, /No se pudo leer manifiesto\.json: el contenido no es EJSON válido/)
      assert.doesNotMatch(error.message, /alumna|example/)
      return true
    })
    writeFileSync(path.join(carpeta, MANIFIESTO), readFileSync(path.join(carpeta, MANIFIESTO + '.copia')))
    rmSync(path.join(carpeta, MANIFIESTO + '.copia'))
    writeFileSync(usuarios, '{"no": "es una lista"}')
    await assert.rejects(leerRespaldo(carpeta), /no contiene una lista/)
    rmSync(usuarios)
    await assert.rejects(leerRespaldo(carpeta), /No se pudo leer usuarios\.json/)
    writeFileSync(path.join(carpeta, MANIFIESTO), JSON.stringify({ formato: 'otro', colecciones: {} }))
    await assert.rejects(leerRespaldo(carpeta), /no describe un respaldo/)
    rmSync(path.join(carpeta, MANIFIESTO))
    await assert.rejects(leerRespaldo(carpeta), /No se pudo leer manifiesto\.json/)
  })

  it('en un proceso aparte, respaldar crea el respaldo en RESPALDO_CARPETA y verificar-respaldo lo acepta', () => {
    const { host, port, name } = mongoose.connection
    const respaldo = ejecutarAislado(`
      const { ejecutar } = await import(new URL('src/scripts/respaldar.js', process.env.RAIZ_BACKEND))
      process.exitCode = await ejecutar()
    `, { MONGODB_URI: `mongodb://${host}:${port}/${name}`, RESPALDO_CARPETA: carpetaBase }, { tope: 60000 })
    assert.equal(respaldo.status, 0, respaldo.stderr)
    const [creada] = readdirSync(carpetaBase)
    assert.match(creada, /^respaldo-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/)
    assert.match(respaldo.stdout, /Respaldo completo en/)
    assert.doesNotMatch(respaldo.stdout, /claveHash|\$2[aby]\$/, 'no muestra datos de las cuentas')

    const verificacion = ejecutarAislado(`
      const { ejecutar } = await import(new URL('src/scripts/verificarRespaldo.js', process.env.RAIZ_BACKEND))
      process.exitCode = await ejecutar({ argumentos: [process.env.CARPETA] })
    `, { CARPETA: path.join(carpetaBase, creada) }, { tope: 60000 })
    assert.equal(verificacion.status, 0, verificacion.stderr)
    assert.match(verificacion.stdout, /Completo/)
  })

  it('en un proceso aparte, respaldar no crea colecciones ni índices en la base que respalda', async () => {
    const { host, port } = mongoose.connection
    const nombre = 'conectatutor_respaldo_sin_cambios'
    const otraBase = mongoose.connection.client.db(nombre)
    await otraBase.dropDatabase()
    try {
      const respaldo = ejecutarAislado(`
        const { ejecutar } = await import(new URL('src/scripts/respaldar.js', process.env.RAIZ_BACKEND))
        process.exitCode = await ejecutar()
      `, { MONGODB_URI: `mongodb://${host}:${port}/${nombre}`, RESPALDO_CARPETA: carpetaBase }, { tope: 60000 })
      assert.equal(respaldo.status, 0, respaldo.stderr)
      assert.match(respaldo.stdout, new RegExp(`Conectado a la base "${nombre}"`))
      assert.deepEqual(await otraBase.listCollections().toArray(), [], 'la base sigue sin colecciones (ni índices)')
    } finally {
      await otraBase.dropDatabase()
    }
  })
})

describe('D04 · Comandos respaldar y verificar-respaldo sin base real', () => {
  const conexionFalsa = ({ falla } = {}) => {
    const llamadas = []
    return {
      llamadas,
      conectarBaseDeDatos: async () => {
        llamadas.push('conectar')
        return { name: 'base_falsa' }
      },
      exportarRespaldo: async ({ carpetaBase, conexion }) => {
        llamadas.push(`exportar ${carpetaBase} de ${conexion.name}`)
        return { carpeta: path.join(carpetaBase, 'respaldo-x'), colecciones: { usuarios: 3 } }
      },
      leerRespaldo: async () => {
        llamadas.push('leer')
        if (falla) throw new Error(falla)
      },
      desconectarBaseDeDatos: async (base) => { llamadas.push(`desconectar ${base?.name}`) },
    }
  }

  it('respaldar sin MONGODB_URI termina con 1 sin conectarse', async () => {
    const conexion = conexionFalsa()
    const registro = registroFalso()
    assert.equal(await respaldar({ entorno: {}, configuracion: { mongodbUri: '' }, conexion, registro }), 1)
    assert.deepEqual(conexion.llamadas, [])
    assert.match(registro.texto(), /Falta MONGODB_URI/)
  })

  it('respaldar usa RESPALDO_CARPETA, comprueba lo escrito y cierra la conexión', async () => {
    const conexion = conexionFalsa()
    const registro = registroFalso()
    const destino = path.resolve('respaldos-de-prueba')
    assert.equal(await respaldar({ entorno: { RESPALDO_CARPETA: ` ${destino} ` }, configuracion: { mongodbUri: 'mongodb://127.0.0.1:1/x' }, conexion, registro }), 0)
    assert.deepEqual(conexion.llamadas, ['conectar', `exportar ${destino} de base_falsa`, 'leer', 'desconectar base_falsa'])
    assert.match(registro.texto(), /usuarios: 3/)
  })

  it('respaldar termina con 1 si la comprobación del respaldo falla', async () => {
    const conexion = conexionFalsa({ falla: 'usuarios.json tiene 2 documentos y el manifiesto dice 3' })
    const registro = registroFalso()
    assert.equal(await respaldar({ entorno: {}, configuracion: { mongodbUri: 'mongodb://127.0.0.1:1/x' }, conexion, registro }), 1)
    assert.equal(conexion.llamadas.at(-1), 'desconectar base_falsa')
    assert.match(registro.texto(), /No se pudo completar el respaldo/)
  })

  it('verificar-respaldo sin carpeta o con un respaldo incompleto termina con 1', async () => {
    assert.equal(await verificar({ argumentos: [], registro: registroFalso() }), 1)
    const leer = async () => { throw new Error('falta usuarios.json') }
    const registro = registroFalso()
    assert.equal(await verificar({ argumentos: ['respaldos/x'], leer, registro }), 1)
    assert.match(registro.texto(), /no está completo: falta usuarios\.json/)
  })
})
