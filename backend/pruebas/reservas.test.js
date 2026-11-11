import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it, mock } from 'node:test'
import { Materia, PerfilTutor, Sesion, Usuario } from '../src/models/index.js'
import { prepararReservas } from '../src/models/sesion.model.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { hoyEnColombia } from '../src/utils/fechas.js'
import { clienteDe, CORREOS } from './ayudas/sesion.js'

const franja = (horaInicio, horaFin) => ({ dia: 'LUNES', horaInicio, horaFin })
const ORIGINAL = franja('10:00', '12:00')
const SOLAPADA = franja('11:00', '13:00')

function lunes(n) {
  const dia = new Date(`${hoyEnColombia()}T00:00:00.000Z`)
  while (n > 0) {
    dia.setUTCDate(dia.getUTCDate() + 1)
    if (dia.getUTCDay() === 1) n -= 1
  }
  return dia.toISOString().slice(0, 10)
}

function diferir() {
  let resolve
  const promise = new Promise((resolver) => { resolve = resolver })
  return { promise, resolve }
}

describe('E4 · RQNF012: intervalos reservados', () => {
  let elena, felipe, bruno, perfil, materia

  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    elena = await clienteDe(CORREOS.elena)
    felipe = await clienteDe(CORREOS.felipe)
    bruno = await clienteDe(CORREOS.bruno)
    const usuario = await Usuario.findOne({ correoInstitucional: CORREOS.bruno })
    perfil = await PerfilTutor.findOne({ estudiante: usuario._id })
    materia = await Materia.findOne({ codigo: 'ADM-02' })
  })
  after(detenerBaseDePrueba)

  const solicitud = (cambios = {}) => ({
    tutor: perfil.id, materia: materia.id, fecha: lunes(4), franja: ORIGINAL,
    tema: 'Resolver el taller de planeación', ...cambios,
  })

  async function cambiarDisponibilidad(disponibilidad) {
    const respuesta = await bruno.put('/tutores/mi-perfil', {
      biografia: perfil.biografia, materias: perfil.materias.map(String),
      tarifaHora: perfil.tarifaHora, disponibilidad,
    })
    assert.equal(respuesta.status, 200)
    assert.equal(respuesta.body.estadoVerificacion, 'VERIFICADO')
  }

  for (const estado of ['PENDIENTE', 'CONFIRMADA']) {
    it(`B1: una reserva ${estado} impide cruces tras editar la disponibilidad`, async () => {
      const creada = await elena.post('/sesiones', solicitud())
      assert.equal(creada.status, 201)
      if (estado === 'CONFIRMADA') assert.equal((await bruno.patch(`/sesiones/${creada.body.id}/confirmar`)).status, 200)
      await cambiarDisponibilidad([SOLAPADA])
      const respuesta = await felipe.post('/sesiones', solicitud({ franja: SOLAPADA }))
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'RQNF012')
      assert.equal(await Sesion.countDocuments({ tutor: perfil._id, fecha: new Date(`${lunes(4)}T00:00:00Z`) }), 1)
      const ocupacion = await felipe.get(`/tutores/${perfil.id}/ocupacion`)
      assert.deepEqual(ocupacion.body.filter((reserva) => reserva.fecha === lunes(4)), [{ fecha: lunes(4), franja: ORIGINAL }])
      assert.equal((await bruno.patch(`/sesiones/${creada.body.id}/cancelar`, { motivo: 'Cambio de planes' })).status, 200)
      assert.equal((await felipe.post('/sesiones', solicitud({ franja: SOLAPADA }))).status, 201)
    })
  }

  it('rechaza intervalos contenidos, envolventes y un cruce de un minuto', async () => {
    assert.equal((await elena.post('/sesiones', solicitud())).status, 201)
    for (const nueva of [franja('10:30', '11:30'), franja('09:00', '13:00'), franja('11:59', '13:00')]) {
      await cambiarDisponibilidad([nueva])
      const respuesta = await felipe.post('/sesiones', solicitud({ franja: nueva }))
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'RQNF012')
    }
  })

  it('admite franjas consecutivas y el mismo intervalo otro día o con otro tutor', async () => {
    assert.equal((await elena.post('/sesiones', solicitud())).status, 201)
    const siguiente = franja('12:00', '14:00')
    await cambiarDisponibilidad([ORIGINAL, siguiente])
    assert.equal((await felipe.post('/sesiones', solicitud({ franja: siguiente }))).status, 201)
    assert.equal((await felipe.post('/sesiones', solicitud({ fecha: lunes(5) }))).status, 201)
    const otroUsuario = await Usuario.findOne({ correoInstitucional: CORREOS.andrea })
    const otroPerfil = await PerfilTutor.findOne({ estudiante: otroUsuario._id })
    otroPerfil.disponibilidad = [ORIGINAL]
    await otroPerfil.save()
    const otraMateria = await Materia.findOne({ codigo: 'SIS-04' })
    assert.equal((await felipe.post('/sesiones', solicitud({ tutor: otroPerfil.id, materia: otraMateria.id }))).status, 201)
  })

  it('dos solicitudes concurrentes con distinta hora de inicio no pueden solaparse', { timeout: 15000 }, async (t) => {
    const original = Sesion.create.bind(Sesion)
    const detenida = diferir()
    const continuar = diferir()
    t.after(() => continuar.resolve())
    mock.method(Sesion, 'create', async (...argumentos) => {
      if (argumentos[0].franja.horaInicio === ORIGINAL.horaInicio) {
        detenida.resolve()
        await continuar.promise
      }
      return original(...argumentos)
    })
    try {
      const primera = elena.post('/sesiones', solicitud()).then((respuesta) => respuesta)
      await detenida.promise
      await cambiarDisponibilidad([SOLAPADA])
      const segunda = await felipe.post('/sesiones', solicitud({ franja: SOLAPADA }))
      continuar.resolve()
      const respuesta = await primera
      assert.equal(segunda.status, 201)
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'RQNF012')
      assert.equal(await Sesion.countDocuments({ tutor: perfil._id, fecha: new Date(`${lunes(4)}T00:00:00Z`) }), 1)
    } finally {
      continuar.resolve()
      mock.restoreAll()
    }
  })

  it('una reprogramación solapada responde 409 y conserva reserva y propuesta', async () => {
    const primera = await elena.post('/sesiones', solicitud())
    const segunda = await felipe.post('/sesiones', solicitud({ fecha: lunes(5) }))
    await cambiarDisponibilidad([SOLAPADA])
    const ruta = `/sesiones/${segunda.body.id}/reprogramacion`
    assert.equal((await felipe.put(ruta, { fecha: lunes(4), franja: SOLAPADA })).status, 200)
    const respuesta = await bruno.patch(ruta, { acepta: true })
    assert.equal(respuesta.status, 409)
    assert.equal(respuesta.body.regla, 'RQNF012')
    const sinCambiar = await felipe.get(`/sesiones/${segunda.body.id}`)
    assert.equal(sinCambiar.body.fecha, lunes(5))
    assert.deepEqual(sinCambiar.body.franja, ORIGINAL)
    assert.ok(sinCambiar.body.reprogramacion)
    assert.equal((await elena.get(`/sesiones/${primera.body.id}`)).body.fecha, lunes(4))
    assert.equal((await elena.patch(`/sesiones/${primera.body.id}/cancelar`, { motivo: 'Cambio de planes' })).status, 200)
    assert.equal((await bruno.patch(ruta, { acepta: true })).status, 200)
    assert.equal((await elena.post('/sesiones', solicitud({ fecha: lunes(5), franja: SOLAPADA }))).status, 201)
    assert.equal((await elena.post('/sesiones', solicitud({ franja: SOLAPADA }))).status, 409)
  })

  it('dos aceptaciones concurrentes de intervalos solapados solo mueven una reserva', async () => {
    const primera = await elena.post('/sesiones', solicitud({ fecha: lunes(5) }))
    const segunda = await felipe.post('/sesiones', solicitud({ fecha: lunes(6) }))
    await cambiarDisponibilidad([SOLAPADA])
    for (const [cliente, sesion] of [[elena, primera], [felipe, segunda]]) {
      assert.equal((await cliente.put(`/sesiones/${sesion.body.id}/reprogramacion`, { fecha: lunes(4), franja: SOLAPADA })).status, 200)
    }
    const respuestas = await Promise.all([primera, segunda].map((sesion) => bruno.patch(`/sesiones/${sesion.body.id}/reprogramacion`, { acepta: true })))
    assert.deepEqual(respuestas.map((respuesta) => respuesta.status).sort(), [200, 409])
    const indicePerdedora = respuestas.findIndex((respuesta) => respuesta.status === 409)
    assert.equal(respuestas[indicePerdedora].body.regla, 'RQNF012')
    const original = [primera, segunda][indicePerdedora].body
    const conservada = (await [elena, felipe][indicePerdedora].get(`/sesiones/${original.id}`)).body
    assert.equal(conservada.fecha, original.fecha)
    assert.ok(conservada.reprogramacion)
  })

  it('una aceptación y una solicitud concurrentes con distinto inicio no se solapan', { timeout: 15000 }, async (t) => {
    const creada = await elena.post('/sesiones', solicitud({ fecha: lunes(5) }))
    const ruta = `/sesiones/${creada.body.id}/reprogramacion`
    assert.equal((await elena.put(ruta, { fecha: lunes(4), franja: ORIGINAL })).status, 200)
    const original = Sesion.findOneAndUpdate.bind(Sesion)
    const detenida = diferir()
    const continuar = diferir()
    t.after(() => continuar.resolve())
    mock.method(Sesion, 'findOneAndUpdate', (...argumentos) => {
      const consulta = original(...argumentos)
      if (argumentos[1].$set?.minutosOcupados) {
        const ejecutar = consulta.exec.bind(consulta)
        consulta.exec = async () => {
          detenida.resolve()
          await continuar.promise
          return ejecutar()
        }
      }
      return consulta
    })
    try {
      const aceptacion = bruno.patch(ruta, { acepta: true }).then((respuesta) => respuesta)
      await detenida.promise
      await cambiarDisponibilidad([SOLAPADA])
      const nueva = await felipe.post('/sesiones', solicitud({ franja: SOLAPADA }))
      continuar.resolve()
      const respuesta = await aceptacion
      assert.equal(nueva.status, 201)
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'RQNF012')
      const conservada = (await elena.get(`/sesiones/${creada.body.id}`)).body
      assert.equal(conservada.fecha, lunes(5))
      assert.deepEqual(conservada.franja, ORIGINAL)
      assert.ok(conservada.reprogramacion)
    } finally {
      continuar.resolve()
      mock.restoreAll()
    }
  })

  it('una sesión puede moverse dentro de su propio intervalo sin perder exclusividad', async () => {
    const creada = await elena.post('/sesiones', solicitud())
    await cambiarDisponibilidad([SOLAPADA])
    const ruta = `/sesiones/${creada.body.id}/reprogramacion`
    assert.equal((await elena.put(ruta, { fecha: lunes(4), franja: SOLAPADA })).status, 200)
    assert.equal((await bruno.patch(ruta, { acepta: true })).status, 200)
    await cambiarDisponibilidad([franja('09:00', '11:00'), SOLAPADA])
    assert.equal((await felipe.post('/sesiones', solicitud({ franja: franja('09:00', '11:00') }))).status, 201)
    assert.equal((await felipe.post('/sesiones', solicitud({ franja: SOLAPADA }))).status, 409)
  })

  it('completa reservas anteriores al índice sin cambiar datos públicos y es repetible', async () => {
    const creada = await elena.post('/sesiones', solicitud())
    const anterior = await Sesion.collection.findOne({ _id: (await Sesion.findById(creada.body.id))._id })
    await Sesion.collection.updateOne({ _id: anterior._id }, { $unset: { minutosOcupados: '' } })
    await prepararReservas()
    await prepararReservas()
    const actual = await Sesion.collection.findOne({ _id: anterior._id })
    assert.deepEqual(actual, anterior)
    assert.equal((await Sesion.findById(creada.body.id)).minutosOcupados, undefined)
    assert.ok(!('minutosOcupados' in (await Sesion.findById(creada.body.id).select('+minutosOcupados')).toJSON()))
    await cambiarDisponibilidad([SOLAPADA])
    assert.equal((await felipe.post('/sesiones', solicitud({ franja: SOLAPADA }))).status, 409)
  })

  it('m1: Swagger y la API coinciden en el motivo opcional después de recortarlo', async () => {
    const creada = await elena.post('/sesiones', solicitud())
    const ruta = `/sesiones/${creada.body.id}/reprogramacion`
    const documento = (await elena.get('/docs.json')).body
    const esquema = documento.components.schemas.PropuestaReprogramacion
    assert.ok(!esquema.required.includes('motivo'))
    const patron = new RegExp(esquema.properties.motivo.pattern)
    for (const motivo of [undefined, '', '   ', 'abc', ' abcd ', 'abcde', 'x'.repeat(300), 'x'.repeat(301), `${' '.repeat(300)}abcde${' '.repeat(300)}`]) {
      const valido = motivo === undefined || !motivo.trim() || (motivo.trim().length >= 5 && motivo.trim().length <= 300)
      if (motivo !== undefined) assert.equal(patron.test(motivo), valido)
      const respuesta = await elena.put(ruta, { fecha: lunes(5), franja: ORIGINAL, ...(motivo === undefined ? {} : { motivo }) })
      assert.equal(respuesta.status, valido ? 200 : 400)
      if (valido) {
        assert.equal(respuesta.body.reprogramacion.motivo, motivo?.trim() ?? '')
        assert.equal((await bruno.patch(ruta, { acepta: false })).status, 200)
      }
    }
  })

  it('rechaza preparar datos antiguos solapados sin borrar ni mover las reservas', async () => {
    const creada = await elena.post('/sesiones', solicitud())
    const primera = await Sesion.collection.findOne({ _id: (await Sesion.findById(creada.body.id))._id })
    const heredada = { ...primera, franja: SOLAPADA }
    delete heredada._id
    delete heredada.minutosOcupados
    const { insertedId } = await Sesion.collection.insertOne(heredada)
    await assert.rejects(prepararReservas(), (error) => error.code === 11000)
    assert.deepEqual(await Sesion.collection.findOne({ _id: primera._id }), primera)
    assert.deepEqual((await Sesion.collection.findOne({ _id: insertedId })).franja, SOLAPADA)
    assert.equal(await Sesion.countDocuments({ tutor: perfil._id, fecha: primera.fecha }), 2)
  })
})
