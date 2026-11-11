import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { Materia, PerfilTutor, Sesion, Usuario } from '../src/models/index.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { hoyEnColombia } from '../src/utils/fechas.js'
import { clienteDe, CORREOS } from './ayudas/sesion.js'

const ID_INEXISTENTE = '6728f1a2b3c4d5e6f7a8b9c0'
const FRANJA_ANDREA = { dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00' }
const FRANJA_BRUNO = { dia: 'LUNES', horaInicio: '10:00', horaFin: '12:00' }

/** Devuelve el n-ésimo lunes a partir de mañana, como "AAAA-MM-DD". */
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

/** Sesión del seed entre dos cuentas, en un estado dado. */
async function sesionDelSeed(correoSolicitante, estado, conCalificacion) {
  const solicitante = await Usuario.findOne({ correoInstitucional: correoSolicitante })
  const filtro = { solicitante: solicitante._id, estado }
  if (conCalificacion !== undefined) filtro.calificacion = conCalificacion ? { $ne: null } : null
  return Sesion.findOne(filtro)
}

describe('E4 · Sesiones', () => {
  let anonimo, elena, felipe, andrea, bruno, carolina, administrador
  let perfilAndrea, perfilBruno, programacion, administracion

  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    anonimo = await clienteDe(null)
    elena = await clienteDe(CORREOS.elena)
    felipe = await clienteDe(CORREOS.felipe)
    andrea = await clienteDe(CORREOS.andrea)
    bruno = await clienteDe(CORREOS.bruno)
    carolina = await clienteDe(CORREOS.carolina)
    administrador = await clienteDe(CORREOS.administrador)
    perfilAndrea = await perfilDe(CORREOS.andrea)
    perfilBruno = await perfilDe(CORREOS.bruno)
    programacion = await Materia.findOne({ codigo: 'SIS-04' })
    administracion = await Materia.findOne({ codigo: 'ADM-02' })
  })
  after(detenerBaseDePrueba)

  /** Solicitud válida de Elena a Andrea; cada prueba cambia lo que necesita. */
  const solicitud = (cambios = {}) => ({
    tutor: perfilAndrea.id,
    materia: programacion.id,
    fecha: lunes(4),
    franja: FRANJA_ANDREA,
    tema: 'Repasar ciclos y arreglos para el parcial',
    ...cambios,
  })

  describe('POST /api/sesiones (solicitar)', () => {
    it('crea la solicitud en estado PENDIENTE (RQF012, RQF013)', async () => {
      const respuesta = await elena.post('/sesiones', solicitud())
      assert.equal(respuesta.status, 201)
      const sesion = respuesta.body
      assert.equal(sesion.estado, 'PENDIENTE')
      assert.equal(sesion.miPapel, 'SOLICITANTE')
      assert.equal(sesion.fecha, lunes(4))
      assert.deepEqual(sesion.franja, FRANJA_ANDREA)
      assert.equal(sesion.tutor.estudiante.nombre, 'Andrea Salcedo')
      assert.equal(sesion.tutor.estudiante.sede, 'Riohacha')
      assert.equal(sesion.solicitante.sede, 'Riohacha')
      assert.equal(sesion.materia.codigo, 'SIS-04')
      assert.equal(sesion.calificacion, null)
      // Mientras no se confirme, nadie recibe el correo del otro.
      assert.doesNotMatch(JSON.stringify(sesion), /@uniguajira/)
    })

    it('R1: nadie se pide una tutoría a sí mismo', async () => {
      const respuesta = await andrea.post('/sesiones', solicitud())
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'R1')
    })

    it('R2: la materia debe estar entre las que ofrece el tutor', async () => {
      const respuesta = await elena.post('/sesiones', solicitud({ materia: administracion.id }))
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'R2')
      // Una materia retirada del catálogo tampoco se puede pedir.
      await Materia.updateOne({ _id: programacion._id }, { activa: false })
      assert.equal((await elena.post('/sesiones', solicitud())).body.regla, 'R2')
    })

    it('R3: la franja debe estar en la disponibilidad del tutor', async () => {
      const respuesta = await elena.post('/sesiones', solicitud({ franja: { dia: 'LUNES', horaInicio: '09:00', horaFin: '11:00' } }))
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'R3')
    })

    it('R4: solo se le pide a un tutor verificado', async () => {
      const pendiente = await perfilDe(CORREOS.diego)
      const psicologia = await Materia.findOne({ codigo: 'PSI-01' })
      const respuesta = await elena.post('/sesiones', solicitud({
        tutor: pendiente.id, materia: psicologia.id, franja: { dia: 'LUNES', horaInicio: '16:00', horaFin: '18:00' },
      }))
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'R4')
    })

    it('rechaza con 400 una fecha que no corresponde al día de la franja, pasada, lejana o mal escrita', async () => {
      const martes = new Date(`${lunes(4)}T00:00:00.000Z`)
      martes.setUTCDate(martes.getUTCDate() + 1)
      for (const fecha of [martes.toISOString().slice(0, 10), '2026-01-05', lunes(10), '2026-02-31', '23/11/2026', 20261123]) {
        const respuesta = await elena.post('/sesiones', solicitud({ fecha }))
        assert.equal(respuesta.status, 400, String(fecha))
      }
      assert.equal(await Sesion.countDocuments(), 5)
    })

    it('rechaza con 400 una franja cuyas horas no son texto', async () => {
      for (const franja of [
        { dia: 'LUNES', horaInicio: ['08:00'], horaFin: '10:00' },
        { dia: 'LUNES', horaInicio: '08:00', horaFin: ['10:00'] },
        { dia: ['LUNES'], horaInicio: '08:00', horaFin: '10:00' },
        { dia: 'LUNES', horaInicio: 800, horaFin: 1000 },
      ]) {
        assert.equal((await elena.post('/sesiones', solicitud({ franja }))).status, 400, JSON.stringify(franja))
      }
    })

    it('rechaza con 400 un tema demasiado corto y datos incompletos', async () => {
      assert.equal((await elena.post('/sesiones', solicitud({ tema: 'Ayuda' }))).status, 400)
      assert.equal((await elena.post('/sesiones', solicitud({ tema: 'Programacionavanzada' }))).status, 400)
      const vacia = await elena.post('/sesiones', {})
      assert.equal(vacia.status, 400)
      assert.equal(vacia.body.errores.length, 5)
      assert.equal((await elena.post('/sesiones', solicitud({ tutor: ID_INEXISTENTE }))).status, 404)
    })

    it('RQNF012: la misma franja del mismo día no se reserva dos veces', async () => {
      assert.equal((await elena.post('/sesiones', solicitud())).status, 201)
      const segunda = await felipe.post('/sesiones', solicitud())
      assert.equal(segunda.status, 409)
      assert.equal(segunda.body.regla, 'RQNF012')
      // Otro lunes de la misma franja sí está libre.
      assert.equal((await felipe.post('/sesiones', solicitud({ fecha: lunes(5) }))).status, 201)
    })

    it('RQNF012: de dos solicitudes simultáneas a la misma franja solo entra una', async () => {
      const respuestas = await Promise.all([
        elena.post('/sesiones', solicitud()),
        felipe.post('/sesiones', solicitud()),
        carolina.post('/sesiones', solicitud()),
      ])
      const estados = respuestas.map((respuesta) => respuesta.status).sort()
      assert.deepEqual(estados, [201, 409, 409])
      assert.equal(await Sesion.countDocuments({ tutor: perfilAndrea._id, fecha: new Date(`${lunes(4)}T00:00:00.000Z`) }), 1)
    })

    it('exige sesión de estudiante: 401 sin token y 403 para el administrador', async () => {
      assert.equal((await anonimo.post('/sesiones', solicitud())).status, 401)
      assert.equal((await administrador.post('/sesiones', solicitud())).status, 403)
    })
  })

  describe('GET /api/sesiones (Mis sesiones, RQF015)', () => {
    it('cada quien ve solo las suyas, como solicitante y como tutor', async () => {
      const deElena = await elena.get('/sesiones')
      assert.equal(deElena.status, 200)
      assert.deepEqual(deElena.body.map((sesion) => sesion.estado).sort(), ['FINALIZADA', 'PENDIENTE'])
      assert.ok(deElena.body.every((sesion) => sesion.miPapel === 'SOLICITANTE'))

      const deAndrea = await andrea.get('/sesiones')
      assert.equal(deAndrea.body.length, 2)
      assert.ok(deAndrea.body.every((sesion) => sesion.miPapel === 'TUTOR'))

      assert.equal((await carolina.get('/sesiones?papel=SOLICITANTE')).body.length, 0)
      assert.equal((await carolina.get('/sesiones?papel=tutor')).body.length, 1)
    })

    it('filtra por estado y rechaza filtros mal escritos', async () => {
      assert.equal((await felipe.get('/sesiones?estado=FINALIZADA')).body.length, 1)
      assert.equal((await felipe.get('/sesiones?estado=confirmada')).body.length, 1)
      assert.equal((await felipe.get('/sesiones?estado=APLAZADA')).status, 400)
      assert.equal((await felipe.get('/sesiones?papel=JEFE')).status, 400)
    })

    it('la coordinación ve todas, sin correos; sin sesión responde 401', async () => {
      const todas = await administrador.get('/sesiones')
      assert.equal(todas.body.length, 5)
      assert.doesNotMatch(JSON.stringify(todas.body), /@uniguajira/)
      assert.equal((await anonimo.get('/sesiones')).status, 401)
    })

    it('GET /api/sesiones/:id solo responde a quien participa o a la coordinación', async () => {
      const sesion = await sesionDelSeed(CORREOS.elena, 'PENDIENTE')
      assert.equal((await elena.get(`/sesiones/${sesion.id}`)).status, 200)
      assert.equal((await andrea.get(`/sesiones/${sesion.id}`)).body.miPapel, 'TUTOR')
      assert.equal((await administrador.get(`/sesiones/${sesion.id}`)).body.miPapel, 'COORDINACION')
      assert.equal((await felipe.get(`/sesiones/${sesion.id}`)).status, 403)
      assert.equal((await elena.get(`/sesiones/${ID_INEXISTENTE}`)).status, 404)
      assert.equal((await elena.get('/sesiones/abc')).status, 400)
    })
  })

  describe('Cambios de estado (R5, RQF014, RQF016)', () => {
    let pendiente, confirmada, finalizada

    beforeEach(async () => {
      pendiente = await sesionDelSeed(CORREOS.elena, 'PENDIENTE') // Elena -> Andrea
      confirmada = await sesionDelSeed(CORREOS.felipe, 'CONFIRMADA') // Felipe -> Bruno
      finalizada = await sesionDelSeed(CORREOS.felipe, 'FINALIZADA') // Felipe -> Bruno, sin calificar
    })

    it('el tutor acepta: PENDIENTE -> CONFIRMADA, y desde ahí ya se ven los correos', async () => {
      const respuesta = await andrea.patch(`/sesiones/${pendiente.id}/confirmar`)
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.estado, 'CONFIRMADA')
      assert.equal(respuesta.body.solicitante.correoInstitucional, CORREOS.elena)
      assert.equal((await elena.get(`/sesiones/${pendiente.id}`)).body.tutor.estudiante.correoInstitucional, CORREOS.andrea)
    })

    it('solo el tutor de la sesión puede aceptar, rechazar o finalizar', async () => {
      assert.equal((await elena.patch(`/sesiones/${pendiente.id}/confirmar`)).status, 403)
      assert.equal((await bruno.patch(`/sesiones/${pendiente.id}/confirmar`)).status, 403)
      assert.equal((await elena.patch(`/sesiones/${pendiente.id}/rechazar`, { motivo: 'No puedo ese día' })).status, 403)
      assert.equal((await felipe.patch(`/sesiones/${confirmada.id}/finalizar`)).status, 403)
      assert.equal((await administrador.patch(`/sesiones/${pendiente.id}/confirmar`)).status, 403)
      assert.equal((await Sesion.findById(pendiente.id)).estado, 'PENDIENTE')
    })

    it('el tutor rechaza con motivo: PENDIENTE -> RECHAZADA; sin motivo responde 400', async () => {
      assert.equal((await andrea.patch(`/sesiones/${pendiente.id}/rechazar`, {})).status, 400)
      assert.equal((await andrea.patch(`/sesiones/${pendiente.id}/rechazar`, { motivo: 'no' })).status, 400)
      const respuesta = await andrea.patch(`/sesiones/${pendiente.id}/rechazar`, { motivo: 'Ese día tengo parcial' })
      assert.equal(respuesta.body.estado, 'RECHAZADA')
      assert.equal(respuesta.body.motivo, 'Ese día tengo parcial')
    })

    it('cualquiera de las dos partes cancela con motivo, y la franja queda libre', async () => {
      const porSolicitante = await elena.patch(`/sesiones/${pendiente.id}/cancelar`, { motivo: 'Ya resolví la duda' })
      assert.equal(porSolicitante.body.estado, 'CANCELADA')
      const porTutor = await bruno.patch(`/sesiones/${confirmada.id}/cancelar`, { motivo: 'Me enfermé, lo siento' })
      assert.equal(porTutor.body.estado, 'CANCELADA')
      assert.equal((await elena.patch(`/sesiones/${confirmada.id}/cancelar`, { motivo: 'No es mi sesión' })).status, 403)

      const fechaLiberada = pendiente.fecha.toISOString().slice(0, 10)
      if (fechaLiberada > hoyEnColombia()) {
        assert.equal((await felipe.post('/sesiones', solicitud({ fecha: fechaLiberada }))).status, 201)
      }
    })

    it('el tutor finaliza una sesión confirmada: CONFIRMADA -> FINALIZADA', async () => {
      const respuesta = await bruno.patch(`/sesiones/${confirmada.id}/finalizar`)
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.estado, 'FINALIZADA')
    })

    it('R5: las transiciones que no existen responden 409', async () => {
      const intentos = [
        await andrea.patch(`/sesiones/${pendiente.id}/finalizar`), // PENDIENTE -> FINALIZADA
        await bruno.patch(`/sesiones/${confirmada.id}/confirmar`), // CONFIRMADA -> CONFIRMADA
        await bruno.patch(`/sesiones/${confirmada.id}/rechazar`, { motivo: 'Ya no puedo ese día' }), // CONFIRMADA -> RECHAZADA
        await bruno.patch(`/sesiones/${finalizada.id}/cancelar`, { motivo: 'Cancelar algo ya hecho' }), // FINALIZADA -> CANCELADA
        await bruno.patch(`/sesiones/${finalizada.id}/finalizar`), // FINALIZADA -> FINALIZADA
      ]
      for (const respuesta of intentos) {
        assert.equal(respuesta.status, 409)
        assert.equal(respuesta.body.regla, 'R5')
      }
      const cancelada = await sesionDelSeed(CORREOS.felipe, 'CANCELADA')
      assert.equal((await andrea.patch(`/sesiones/${cancelada.id}/confirmar`)).body.regla, 'R5')
    })

    it('si el tutor acepta y el solicitante cancela a la vez, gana una sola acción', async () => {
      const [aceptar, cancelar] = await Promise.all([
        andrea.patch(`/sesiones/${pendiente.id}/confirmar`),
        elena.patch(`/sesiones/${pendiente.id}/cancelar`, { motivo: 'Cambio de planes' }),
      ])
      const final = (await Sesion.findById(pendiente.id)).estado
      assert.ok(['CONFIRMADA', 'CANCELADA'].includes(final))
      // Cancelar una confirmada es válido, así que ambas pueden responder 200; lo que no puede pasar es quedar a medias.
      assert.ok(aceptar.status === 200 || cancelar.status === 200)
    })
  })

  describe('POST /api/sesiones/:id/calificacion (RQF017, R6, R7)', () => {
    let sinCalificar

    beforeEach(async () => {
      sinCalificar = await sesionDelSeed(CORREOS.felipe, 'FINALIZADA', false) // Felipe -> Bruno
    })

    it('el solicitante califica una sesión finalizada y cambia el promedio del tutor (RQF018)', async () => {
      const antes = (await felipe.get(`/tutores/${perfilBruno.id}`)).body
      assert.deepEqual([antes.promedio, antes.totalCalificaciones], [0, 0])

      const respuesta = await felipe.post(`/sesiones/${sinCalificar.id}/calificacion`, { puntaje: 4, resena: '  Explicó con paciencia  ' })
      assert.equal(respuesta.status, 201)
      assert.equal(respuesta.body.calificacion.puntaje, 4)
      assert.equal(respuesta.body.calificacion.resena, 'Explicó con paciencia')

      const despues = (await felipe.get(`/tutores/${perfilBruno.id}`)).body
      assert.deepEqual([despues.promedio, despues.totalCalificaciones], [4, 1])
      assert.equal(despues.resenas[0].autor, 'Felipe C.')
    })

    it('R6: una sola vez', async () => {
      assert.equal((await felipe.post(`/sesiones/${sinCalificar.id}/calificacion`, { puntaje: 5 })).status, 201)
      const repetida = await felipe.post(`/sesiones/${sinCalificar.id}/calificacion`, { puntaje: 1 })
      assert.equal(repetida.status, 409)
      assert.equal(repetida.body.regla, 'R6')
      assert.equal((await Sesion.findById(sinCalificar.id)).calificacion.puntaje, 5)
    })

    it('R6: solo una sesión finalizada', async () => {
      const confirmada = await sesionDelSeed(CORREOS.felipe, 'CONFIRMADA')
      const respuesta = await felipe.post(`/sesiones/${confirmada.id}/calificacion`, { puntaje: 5 })
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'R6')
    })

    it('R7: el puntaje es un entero de 1 a 5', async () => {
      for (const puntaje of [0, 6, 4.5, '5', null, undefined]) {
        const respuesta = await felipe.post(`/sesiones/${sinCalificar.id}/calificacion`, { puntaje })
        assert.equal(respuesta.status, 400, String(puntaje))
        assert.equal(respuesta.body.regla, 'R7')
      }
      assert.equal((await felipe.post(`/sesiones/${sinCalificar.id}/calificacion`, { puntaje: 5, resena: 'x'.repeat(501) })).status, 400)
    })

    it('solo califica quien pidió la tutoría', async () => {
      assert.equal((await bruno.post(`/sesiones/${sinCalificar.id}/calificacion`, { puntaje: 5 })).status, 403)
      assert.equal((await elena.post(`/sesiones/${sinCalificar.id}/calificacion`, { puntaje: 5 })).status, 403)
      assert.equal((await anonimo.post(`/sesiones/${sinCalificar.id}/calificacion`, { puntaje: 5 })).status, 401)
    })
  })

  describe('Reprogramación (RQF028)', () => {
    let sesion

    beforeEach(async () => {
      // Felipe le pide a Bruno y Bruno acepta: sesión confirmada en una fecha futura.
      const creada = await felipe.post('/sesiones', {
        tutor: perfilBruno.id, materia: administracion.id, fecha: lunes(4), franja: FRANJA_BRUNO, tema: 'Resolver el taller de planeación',
      })
      assert.equal(creada.status, 201)
      await bruno.patch(`/sesiones/${creada.body.id}/confirmar`)
      sesion = creada.body
    })

    it('una parte propone otra fecha y la otra la acepta: la sesión cambia de día', async () => {
      const propuesta = await felipe.put(`/sesiones/${sesion.id}/reprogramacion`, { fecha: lunes(5), franja: FRANJA_BRUNO, motivo: 'Ese día tengo un parcial' })
      assert.equal(propuesta.status, 200)
      assert.equal(propuesta.body.fecha, lunes(4)) // todavía no cambia
      assert.equal(propuesta.body.reprogramacion.fecha, lunes(5))
      assert.equal(propuesta.body.reprogramacion.esMia, true)

      const respuesta = await bruno.patch(`/sesiones/${sesion.id}/reprogramacion`, { acepta: true })
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.fecha, lunes(5))
      assert.equal(respuesta.body.estado, 'CONFIRMADA')
      assert.equal(respuesta.body.reprogramacion, null)

      // La fecha anterior quedó libre para otra persona.
      const otra = await elena.post('/sesiones', { tutor: perfilBruno.id, materia: administracion.id, fecha: lunes(4), franja: FRANJA_BRUNO, tema: 'Dudas de planeación estratégica' })
      assert.equal(otra.status, 201)
    })

    it('si la otra parte no acepta, la sesión queda como estaba', async () => {
      await bruno.put(`/sesiones/${sesion.id}/reprogramacion`, { fecha: lunes(5), franja: FRANJA_BRUNO })
      const respuesta = await felipe.patch(`/sesiones/${sesion.id}/reprogramacion`, { acepta: false })
      assert.equal(respuesta.body.fecha, lunes(4))
      assert.equal(respuesta.body.reprogramacion, null)
    })

    it('quien propone no puede responderse a sí mismo, ni un tercero', async () => {
      await felipe.put(`/sesiones/${sesion.id}/reprogramacion`, { fecha: lunes(5), franja: FRANJA_BRUNO })
      assert.equal((await felipe.patch(`/sesiones/${sesion.id}/reprogramacion`, { acepta: true })).status, 403)
      assert.equal((await elena.patch(`/sesiones/${sesion.id}/reprogramacion`, { acepta: true })).status, 403)
      assert.equal((await bruno.patch(`/sesiones/${sesion.id}/reprogramacion`, { acepta: 'si' })).status, 400)
    })

    it('rechaza propuestas no válidas', async () => {
      const ruta = `/sesiones/${sesion.id}/reprogramacion`
      assert.equal((await felipe.put(ruta, { fecha: lunes(4), franja: FRANJA_BRUNO })).status, 400) // no cambia nada
      assert.equal((await felipe.put(ruta, { fecha: lunes(5), franja: FRANJA_ANDREA })).body.regla, 'R3') // franja que Bruno no tiene
      assert.equal((await felipe.put(ruta, { fecha: '2026-01-05', franja: FRANJA_BRUNO })).status, 400) // pasada
      assert.equal((await elena.put(ruta, { fecha: lunes(5), franja: FRANJA_BRUNO })).status, 403) // no participa
      assert.equal((await felipe.put(ruta, { fecha: lunes(5), franja: FRANJA_BRUNO })).status, 200)
      assert.equal((await bruno.put(ruta, { fecha: lunes(6), franja: FRANJA_BRUNO })).status, 409) // ya hay una pendiente
      assert.equal((await bruno.patch(`/sesiones/${ID_INEXISTENTE}/reprogramacion`, { acepta: true })).status, 404)
    })

    it('no se puede aceptar si la nueva franja ya la reservó otra persona (RQNF012)', async () => {
      await felipe.put(`/sesiones/${sesion.id}/reprogramacion`, { fecha: lunes(5), franja: FRANJA_BRUNO })
      await elena.post('/sesiones', { tutor: perfilBruno.id, materia: administracion.id, fecha: lunes(5), franja: FRANJA_BRUNO, tema: 'Dudas de planeación estratégica' })
      const respuesta = await bruno.patch(`/sesiones/${sesion.id}/reprogramacion`, { acepta: true })
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'RQNF012')
      assert.equal((await Sesion.findById(sesion.id)).fecha.toISOString().slice(0, 10), lunes(4))
    })

    it('una sesión finalizada o cancelada no se reprograma', async () => {
      await bruno.patch(`/sesiones/${sesion.id}/finalizar`)
      const respuesta = await felipe.put(`/sesiones/${sesion.id}/reprogramacion`, { fecha: lunes(5), franja: FRANJA_BRUNO })
      assert.equal(respuesta.status, 409)
      assert.equal(respuesta.body.regla, 'R5')
    })
  })

  describe('GET /api/tutores/:id/ocupacion', () => {
    it('lista las franjas reservadas desde hoy, sin datos de quién reservó', async () => {
      await elena.post('/sesiones', solicitud())
      const respuesta = await felipe.get(`/tutores/${perfilAndrea.id}/ocupacion`)
      assert.equal(respuesta.status, 200)
      assert.ok(respuesta.body.some((ocupada) => ocupada.fecha === lunes(4) && ocupada.franja.horaInicio === '08:00'))
      assert.ok(respuesta.body.every((ocupada) => Object.keys(ocupada).sort().join() === 'fecha,franja'))
      assert.equal((await felipe.get(`/tutores/${ID_INEXISTENTE}/ocupacion`)).status, 404)
      assert.equal((await anonimo.get(`/tutores/${perfilAndrea.id}/ocupacion`)).status, 401)
    })
  })
})
