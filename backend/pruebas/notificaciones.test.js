import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { Materia, Notificacion, PerfilTutor, Sesion, Usuario } from '../src/models/index.js'
import { listar } from '../src/services/notificaciones.service.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { aFechaGuardada, hoyEnColombia, momentoDeInicio } from '../src/utils/fechas.js'
import { afirmarContrato } from './ayudas/contrato.js'
import { clienteDe, CORREOS } from './ayudas/sesion.js'

const FRANJA = { dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00' }

function lunes(n) {
  const dia = new Date(`${hoyEnColombia()}T00:00:00.000Z`)
  let encontrados = 0
  while (encontrados < n) {
    dia.setUTCDate(dia.getUTCDate() + 1)
    if (dia.getUTCDay() === 1) encontrados += 1
  }
  return dia.toISOString().slice(0, 10)
}

describe('Campana de notificaciones y encuesta de cancelación (RQF022, RQF016)', () => {
  let elena, andrea, administrador, perfilAndrea, materia
  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    elena = await clienteDe(CORREOS.elena)
    andrea = await clienteDe(CORREOS.andrea)
    administrador = await clienteDe(CORREOS.administrador)
    const usuarioAndrea = await Usuario.findOne({ correoInstitucional: CORREOS.andrea })
    perfilAndrea = await PerfilTutor.findOne({ estudiante: usuarioAndrea._id })
    materia = await Materia.findOne({ codigo: 'SIS-04' })
  })
  after(detenerBaseDePrueba)

  const solicitar = () => elena.post('/sesiones', {
    tutor: perfilAndrea.id, materia: materia.id, fecha: lunes(4), franja: FRANJA, tema: 'Repasar ciclos para el parcial',
  })
  const titulos = async (cliente) => (await cliente.get('/notificaciones')).body.notificaciones.map((n) => n.titulo)

  it('avisa a la tutora de la solicitud y al estudiante cuando la aceptan', async () => {
    const { body: sesion } = await solicitar()
    const deAndrea = await andrea.get('/notificaciones')
    assert.equal(deAndrea.status, 200)
    await afirmarContrato(deAndrea, '/notificaciones', 'get')
    assert.equal(deAndrea.body.sinLeer, 1)
    assert.match(deAndrea.body.notificaciones[0].titulo, /Elena te pidió una tutoría/)
    assert.equal(deAndrea.body.notificaciones[0].ruta, '/solicitudes')

    await andrea.patch(`/sesiones/${sesion.id}/confirmar`)
    assert.match((await titulos(elena))[0], /Andrea aceptó tu solicitud/)
  })

  it('al finalizar invita a calificar y marcar leídas pone el contador en cero', async () => {
    const { body: sesion } = await solicitar()
    await andrea.patch(`/sesiones/${sesion.id}/confirmar`)
    await andrea.patch(`/sesiones/${sesion.id}/finalizar`)
    const lista = (await elena.get('/notificaciones')).body
    assert.equal(lista.notificaciones[0].ruta, `/sesiones/${sesion.id}/calificar`)
    assert.ok(lista.sinLeer >= 2)
    assert.equal((await elena.patch('/notificaciones/leidas')).status, 204)
    assert.equal((await elena.get('/notificaciones')).body.sinLeer, 0)
  })

  it('crea un recordatorio un día antes, otro una hora antes y uno al terminar, sin repetirlos', async () => {
    const { body: creada } = await solicitar()
    await andrea.patch(`/sesiones/${creada.id}/confirmar`)
    const sesion = await Sesion.findById(creada.id)
    const inicio = momentoDeInicio(lunes(4), FRANJA.horaInicio).getTime()
    const usuarioElena = await Usuario.findOne({ correoInstitucional: CORREOS.elena })
    const tipos = async (momento) => {
      await listar(usuarioElena, new Date(momento))
      return (await Notificacion.find({ usuario: usuarioElena._id, sesion: sesion._id, tipo: { $in: ['RECORDATORIO', 'SESION_TERMINADA'] } })).length
    }
    assert.equal(await tipos(inicio - 20 * 3600000), 1, 'un día antes')
    assert.equal(await tipos(inicio - 19 * 3600000), 1, 'no se repite')
    assert.equal(await tipos(inicio - 30 * 60000), 2, 'una hora antes')
    assert.equal(await tipos(inicio + 3 * 3600000), 3, 'al terminar el horario')
    assert.equal(sesion.fecha.getTime(), aFechaGuardada(lunes(4)).getTime())
  })

  it('cancela con la encuesta, avisa a la otra parte y Coordinación cuenta las razones', async () => {
    const { body: sesion } = await solicitar()
    const sinRazon = await elena.patch(`/sesiones/${sesion.id}/cancelar`, { motivos: [] })
    assert.equal(sinRazon.status, 400)
    const otroSinTexto = await elena.patch(`/sesiones/${sesion.id}/cancelar`, { motivos: ['OTRO'] })
    assert.equal(otroSinTexto.status, 400)

    const cancelada = await elena.patch(`/sesiones/${sesion.id}/cancelar`, { motivos: ['CRUCE_HORARIO', 'OTRO'], motivo: 'Me cambiaron el parcial' })
    assert.equal(cancelada.status, 200)
    await afirmarContrato(cancelada, '/sesiones/{id}/cancelar', 'patch')
    assert.deepEqual(cancelada.body.motivosCancelacion, ['CRUCE_HORARIO', 'OTRO'])
    assert.equal(cancelada.body.motivo, 'Tengo un cruce de horario. Me cambiaron el parcial')
    assert.match((await titulos(andrea))[0], /Elena canceló la tutoría/)

    const metricas = await administrador.get('/coordinacion/metricas')
    assert.equal(metricas.status, 200)
    await afirmarContrato(metricas, '/coordinacion/metricas', 'get')
    assert.equal(metricas.body.motivosCancelacion.CRUCE_HORARIO, 1)
    assert.equal(metricas.body.motivosCancelacion.OTRO, 1)
    assert.equal(metricas.body.motivosCancelacion.YA_RESOLVI, 0)
  })

  it('Coordinación no tiene campana', async () => {
    assert.equal((await administrador.get('/notificaciones')).status, 403)
  })
})
