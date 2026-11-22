import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Materia, PerfilTutor, Sesion, Usuario } from '../src/models/index.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { hoyEnColombia } from '../src/utils/fechas.js'
import { afirmarContrato } from './ayudas/contrato.js'
import { clienteDe, CORREOS, moverAlPasado } from './ayudas/sesion.js'

const ID_INEXISTENTE = '6728f1a2b3c4d5e6f7a8b9c0'
const FRANJA_BRUNO = { dia: 'LUNES', horaInicio: '10:00', horaFin: '12:00' }

function lunes(n) {
  const dia = new Date(`${hoyEnColombia()}T00:00:00.000Z`)
  let encontrados = 0
  while (encontrados < n) {
    dia.setUTCDate(dia.getUTCDate() + 1)
    if (dia.getUTCDay() === 1) encontrados += 1
  }
  return dia.toISOString().slice(0, 10)
}

async function perfilDe(correo) {
  const usuario = await Usuario.findOne({ correoInstitucional: correo })
  return PerfilTutor.findOne({ estudiante: usuario._id })
}

describe('E4 · Las respuestas reales cumplen lo que publica Swagger', () => {
  let anonimo, elena, felipe, bruno, administrador, perfilBruno, materia

  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    anonimo = await clienteDe(null)
    elena = await clienteDe(CORREOS.elena)
    felipe = await clienteDe(CORREOS.felipe)
    bruno = await clienteDe(CORREOS.bruno)
    administrador = await clienteDe(CORREOS.administrador)
    perfilBruno = await perfilDe(CORREOS.bruno)
    materia = await Materia.findOne({ codigo: 'ADM-02' })
  })
  after(detenerBaseDePrueba)

  const solicitud = (cambios = {}) => ({
    tutor: perfilBruno.id, materia: materia.id, fecha: lunes(4), franja: FRANJA_BRUNO, tema: 'Resolver el taller de planeación', ...cambios,
  })

  it('solicitar, listar y consultar sesiones', async () => {
    const creada = await elena.post('/sesiones', solicitud())
    await afirmarContrato(creada, '/sesiones', 'post') // 201
    await afirmarContrato(await felipe.post('/sesiones', solicitud()), '/sesiones', 'post') // 409 RQNF012
    await afirmarContrato(await bruno.post('/sesiones', solicitud()), '/sesiones', 'post') // 409 R1
    await afirmarContrato(await elena.post('/sesiones', {}), '/sesiones', 'post') // 400
    await afirmarContrato(await elena.post('/sesiones', solicitud({ tutor: ID_INEXISTENTE })), '/sesiones', 'post') // 404
    await afirmarContrato(await administrador.post('/sesiones', solicitud()), '/sesiones', 'post') // 403
    await afirmarContrato(await anonimo.post('/sesiones', solicitud()), '/sesiones', 'post') // 401

    await afirmarContrato(await elena.get('/sesiones'), '/sesiones', 'get')
    await afirmarContrato(await bruno.get('/sesiones?papel=TUTOR'), '/sesiones', 'get')
    await afirmarContrato(await administrador.get('/sesiones'), '/sesiones', 'get')
    await afirmarContrato(await elena.get('/sesiones?estado=OTRO'), '/sesiones', 'get')
    await afirmarContrato(await anonimo.get('/sesiones'), '/sesiones', 'get')

    const ruta = `/sesiones/${creada.body.id}`
    await afirmarContrato(await elena.get(ruta), '/sesiones/{id}', 'get')
    await afirmarContrato(await felipe.get(ruta), '/sesiones/{id}', 'get') // 403
    await afirmarContrato(await elena.get(`/sesiones/${ID_INEXISTENTE}`), '/sesiones/{id}', 'get')
    await afirmarContrato(await elena.get('/sesiones/abc'), '/sesiones/{id}', 'get')
  })

  it('cambios de estado, calificación y reprogramación', async () => {
    const { body: sesion } = await elena.post('/sesiones', solicitud())
    const ruta = `/sesiones/${sesion.id}`

    await afirmarContrato(await elena.patch(`${ruta}/confirmar`), '/sesiones/{id}/confirmar', 'patch') // 403
    await afirmarContrato(await bruno.patch(`${ruta}/finalizar`), '/sesiones/{id}/finalizar', 'patch') // 409 R5
    await afirmarContrato(await bruno.patch(`${ruta}/rechazar`, {}), '/sesiones/{id}/rechazar', 'patch') // 400
    await afirmarContrato(await bruno.patch(`${ruta}/confirmar`), '/sesiones/{id}/confirmar', 'patch') // 200, ya con correos
    await afirmarContrato(await bruno.patch(`${ruta}/rechazar`, { motivo: 'Ya no puedo ese día' }), '/sesiones/{id}/rechazar', 'patch') // 409

    await afirmarContrato(await elena.put(`${ruta}/reprogramacion`, { fecha: lunes(5), franja: FRANJA_BRUNO, motivo: 'Tengo un parcial' }), '/sesiones/{id}/reprogramacion', 'put')
    await afirmarContrato(await elena.get(ruta), '/sesiones/{id}', 'get') // con propuesta pendiente
    await afirmarContrato(await bruno.put(`${ruta}/reprogramacion`, { fecha: lunes(6), franja: FRANJA_BRUNO }), '/sesiones/{id}/reprogramacion', 'put') // 409
    await afirmarContrato(await elena.put(`${ruta}/reprogramacion`, {}), '/sesiones/{id}/reprogramacion', 'put') // 400
    await afirmarContrato(await elena.patch(`${ruta}/reprogramacion`, { acepta: true }), '/sesiones/{id}/reprogramacion', 'patch') // 403
    await afirmarContrato(await bruno.patch(`${ruta}/reprogramacion`, {}), '/sesiones/{id}/reprogramacion', 'patch') // 400
    await afirmarContrato(await bruno.patch(`${ruta}/reprogramacion`, { acepta: true }), '/sesiones/{id}/reprogramacion', 'patch') // 200
    await afirmarContrato(await bruno.patch(`${ruta}/reprogramacion`, { acepta: true }), '/sesiones/{id}/reprogramacion', 'patch') // 409

    await afirmarContrato(await elena.post(`${ruta}/calificacion`, { puntaje: 5 }), '/sesiones/{id}/calificacion', 'post') // 409 R6
    await afirmarContrato(await bruno.patch(`${ruta}/finalizar`), '/sesiones/{id}/finalizar', 'patch') // 409 R5, todavía no empieza
    await moverAlPasado(sesion.id)
    await afirmarContrato(await bruno.patch(`${ruta}/finalizar`), '/sesiones/{id}/finalizar', 'patch') // 200
    await afirmarContrato(await elena.post(`${ruta}/calificacion`, { puntaje: 9 }), '/sesiones/{id}/calificacion', 'post') // 400 R7
    await afirmarContrato(await bruno.post(`${ruta}/calificacion`, { puntaje: 5 }), '/sesiones/{id}/calificacion', 'post') // 403
    await afirmarContrato(await elena.post(`${ruta}/calificacion`, { puntaje: 5, resena: 'Muy claro' }), '/sesiones/{id}/calificacion', 'post') // 201
    await afirmarContrato(await elena.get(ruta), '/sesiones/{id}', 'get') // calificada

    const pendiente = await Sesion.findOne({ estado: 'PENDIENTE' })
    await afirmarContrato(await elena.patch(`/sesiones/${pendiente.id}/cancelar`, { motivo: 'Ya resolví la duda' }), '/sesiones/{id}/cancelar', 'patch')
    await afirmarContrato(await elena.patch(`/sesiones/${ID_INEXISTENTE}/cancelar`, { motivo: 'No existe esta sesión' }), '/sesiones/{id}/cancelar', 'patch')
  })

  it('Swagger solo promete el campo regla en los conflictos que de verdad lo traen', async () => {
    const { body: documento } = await anonimo.get('/docs.json')
    const descripcion = (metodo) => documento.paths['/sesiones/{id}/reprogramacion'][metodo].responses[409].description
    const { body: sesion } = await elena.post('/sesiones', solicitud())
    const ruta = `/sesiones/${sesion.id}/reprogramacion`

    // Sin propuesta pendiente: 409 solo con mensaje
    const sinPropuesta = await bruno.patch(ruta, { acepta: false })
    assert.equal(sinPropuesta.status, 409)
    assert.equal(sinPropuesta.body.regla, undefined)
    assert.match(descripcion('patch'), /No hay propuesta pendiente[^.]*: solo trae mensaje, sin regla/)

    // Propuesta repetida: 409 solo con mensaje; R5 sí trae regla
    await elena.put(ruta, { fecha: lunes(5), franja: FRANJA_BRUNO })
    const repetida = await bruno.put(ruta, { fecha: lunes(6), franja: FRANJA_BRUNO })
    assert.equal(repetida.status, 409)
    assert.equal(repetida.body.regla, undefined)
    assert.match(descripcion('put'), /Ya hay una propuesta pendiente: solo trae mensaje, sin regla/)

    // Ningún texto publicado promete regla sin condición en una respuesta que puede no traerla
    for (const metodo of ['put', 'patch']) assert.doesNotMatch(descripcion(metodo), /^[^:]*\. El cuerpo incluye el campo regla$/)
  })

  it('el motivo obligatorio se mide después de quitar espacios al inicio y al final', async () => {
    const documento = await anonimo.get('/docs.json')
    const patron = new RegExp(documento.body.components.schemas.Motivo.properties.motivo.pattern)
    assert.doesNotMatch('   ab   ', patron)
    assert.match('  abcde  ', patron)

    const creada = await elena.post('/sesiones', solicitud())
    assert.equal(creada.status, 201)
    const ruta = `/sesiones/${creada.body.id}/cancelar`

    const invalida = await elena.patch(ruta, { motivo: '   ab   ' })
    assert.equal(invalida.status, 400)
    await afirmarContrato(invalida, '/sesiones/{id}/cancelar', 'patch')

    const cancelada = await elena.patch(ruta, { motivo: '  abcde  ' })
    assert.equal(cancelada.status, 200)
    assert.equal(cancelada.body.motivo, 'abcde')
    await afirmarContrato(cancelada, '/sesiones/{id}/cancelar', 'patch')
  })

  it('ocupación, favoritos y coordinación', async () => {
    await elena.post('/sesiones', solicitud())
    await afirmarContrato(await felipe.get(`/tutores/${perfilBruno.id}/ocupacion`), '/tutores/{id}/ocupacion', 'get')
    await afirmarContrato(await felipe.get(`/tutores/${ID_INEXISTENTE}/ocupacion`), '/tutores/{id}/ocupacion', 'get')

    await afirmarContrato(await elena.put(`/favoritos/${perfilBruno.id}`), '/favoritos/{id}', 'put')
    await afirmarContrato(await elena.put(`/favoritos/${ID_INEXISTENTE}`), '/favoritos/{id}', 'put')
    await afirmarContrato(await elena.get('/favoritos'), '/favoritos', 'get')
    await afirmarContrato(await administrador.get('/favoritos'), '/favoritos', 'get') // 403
    await afirmarContrato(await elena.delete(`/favoritos/${perfilBruno.id}`), '/favoritos/{id}', 'delete')

    const pendiente = await perfilDe(CORREOS.diego)
    await afirmarContrato(await administrador.get('/coordinacion/perfiles'), '/coordinacion/perfiles', 'get')
    await afirmarContrato(await administrador.get('/coordinacion/perfiles?estado=OTRO'), '/coordinacion/perfiles', 'get')
    await afirmarContrato(await elena.get('/coordinacion/perfiles'), '/coordinacion/perfiles', 'get') // 403
    await afirmarContrato(await administrador.patch(`/coordinacion/perfiles/${pendiente.id}/rechazar`, {}), '/coordinacion/perfiles/{id}/rechazar', 'patch')
    await afirmarContrato(await administrador.patch(`/coordinacion/perfiles/${pendiente.id}/verificar`), '/coordinacion/perfiles/{id}/verificar', 'patch')
    await afirmarContrato(await administrador.patch(`/coordinacion/perfiles/${pendiente.id}/verificar`), '/coordinacion/perfiles/{id}/verificar', 'patch') // 409
    await afirmarContrato(await administrador.patch(`/coordinacion/perfiles/${ID_INEXISTENTE}/verificar`), '/coordinacion/perfiles/{id}/verificar', 'patch')
    await afirmarContrato(await administrador.patch(`/coordinacion/perfiles/${pendiente.id}/rechazar`, { motivo: 'Reporte de la comunidad' }), '/coordinacion/perfiles/{id}/rechazar', 'patch')
    await afirmarContrato(await administrador.patch(`/coordinacion/perfiles/${pendiente.id}/rechazar`, { motivo: 'Reporte de la comunidad' }), '/coordinacion/perfiles/{id}/rechazar', 'patch') // 409
    await afirmarContrato(await administrador.get('/coordinacion/metricas'), '/coordinacion/metricas', 'get')
    await afirmarContrato(await anonimo.get('/coordinacion/metricas'), '/coordinacion/metricas', 'get')
  })
})
