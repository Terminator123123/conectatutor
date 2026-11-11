import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { app } from '../src/app.js'
import { Materia, PerfilTutor, Programa, Usuario } from '../src/models/index.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { hoyEnColombia } from '../src/utils/fechas.js'
import { clienteDe, CORREOS } from './ayudas/sesion.js'

const ID_INEXISTENTE = '6728f1a2b3c4d5e6f7a8b9c0'

async function perfilDe(correo) {
  const usuario = await Usuario.findOne({ correoInstitucional: correo })
  return PerfilTutor.findOne({ estudiante: usuario._id })
}

function lunes(n) {
  const dia = new Date(`${hoyEnColombia()}T00:00:00.000Z`)
  let encontrados = 0
  while (encontrados < n) {
    dia.setUTCDate(dia.getUTCDate() + 1)
    if (dia.getUTCDay() === 1) encontrados += 1
  }
  return dia.toISOString().slice(0, 10)
}

describe('E4 · Coordinación, favoritos y ciclo completo', () => {
  let anonimo, elena, diego, administrador

  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    anonimo = await clienteDe(null)
    elena = await clienteDe(CORREOS.elena)
    diego = await clienteDe(CORREOS.diego)
    administrador = await clienteDe(CORREOS.administrador)
  })
  after(detenerBaseDePrueba)

  describe('Verificación de tutores (RQF021)', () => {
    it('lista los perfiles pendientes con el correo para contactarlos', async () => {
      const respuesta = await administrador.get('/coordinacion/perfiles')
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.length, 1)
      assert.equal(respuesta.body[0].estudiante.nombre, 'Diego Manrique')
      assert.equal(respuesta.body[0].estudiante.correoInstitucional, CORREOS.diego)
      assert.equal((await administrador.get('/coordinacion/perfiles?estado=verificado')).body.length, 3)
      assert.equal((await administrador.get('/coordinacion/perfiles?estado=OTRO')).status, 400)
    })

    it('verificar hace que el tutor aparezca en la búsqueda', async () => {
      const perfil = await perfilDe(CORREOS.diego)
      assert.equal((await elena.get('/tutores')).body.length, 3)
      const respuesta = await administrador.patch(`/coordinacion/perfiles/${perfil.id}/verificar`)
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.estadoVerificacion, 'VERIFICADO')
      assert.equal((await elena.get('/tutores')).body.length, 4)
      assert.equal((await administrador.patch(`/coordinacion/perfiles/${perfil.id}/verificar`)).status, 409)
    })

    it('no verifica un perfil incompleto', async () => {
      const perfil = await perfilDe(CORREOS.diego)
      await PerfilTutor.updateOne({ _id: perfil._id }, { materias: [] })
      const respuesta = await administrador.patch(`/coordinacion/perfiles/${perfil.id}/verificar`)
      assert.equal(respuesta.status, 409)
      assert.match(respuesta.body.mensaje, /incompleto/)
    })

    it('rechazar exige motivo, lo guarda y el dueño lo ve; retirar una verificación saca al tutor de la búsqueda', async () => {
      const perfil = await perfilDe(CORREOS.diego)
      assert.equal((await administrador.patch(`/coordinacion/perfiles/${perfil.id}/rechazar`, {})).status, 400)
      const respuesta = await administrador.patch(`/coordinacion/perfiles/${perfil.id}/rechazar`, { motivo: 'Falta el soporte académico' })
      assert.equal(respuesta.body.estadoVerificacion, 'RECHAZADO')
      assert.equal((await diego.get('/tutores/mi-perfil')).body.motivoRechazo, 'Falta el soporte académico')
      assert.equal((await administrador.patch(`/coordinacion/perfiles/${perfil.id}/rechazar`, { motivo: 'Otra vez lo mismo' })).status, 409)

      const verificado = await perfilDe(CORREOS.andrea)
      await administrador.patch(`/coordinacion/perfiles/${verificado.id}/rechazar`, { motivo: 'Reporte de la comunidad' })
      assert.equal((await elena.get('/tutores')).body.length, 2)
    })

    it('responde 404 si el perfil no existe y 400 si el id está mal formado', async () => {
      assert.equal((await administrador.patch(`/coordinacion/perfiles/${ID_INEXISTENTE}/verificar`)).status, 404)
      assert.equal((await administrador.patch('/coordinacion/perfiles/abc/verificar')).status, 400)
    })

    it('toda la coordinación es solo del administrador: 403 para estudiantes y 401 sin sesión', async () => {
      const perfil = await perfilDe(CORREOS.diego)
      for (const cliente of [elena, diego]) {
        assert.equal((await cliente.get('/coordinacion/perfiles')).status, 403)
        assert.equal((await cliente.get('/coordinacion/metricas')).status, 403)
        assert.equal((await cliente.patch(`/coordinacion/perfiles/${perfil.id}/verificar`)).status, 403)
        assert.equal((await cliente.patch(`/coordinacion/perfiles/${perfil.id}/rechazar`, { motivo: 'Sin permiso' })).status, 403)
      }
      assert.equal((await anonimo.get('/coordinacion/metricas')).status, 401)
      assert.equal((await perfilDe(CORREOS.diego)).estadoVerificacion, 'PENDIENTE')
    })
  })

  describe('GET /api/coordinacion/metricas', () => {
    it('entrega cifras agregadas por sede y en total, sin datos personales', async () => {
      const respuesta = await administrador.get('/coordinacion/metricas')
      assert.equal(respuesta.status, 200)
      const { total, porSede } = respuesta.body
      assert.deepEqual(total, {
        solicitudes: 5, pendientes: 1, confirmadas: 1, finalizadas: 2, rechazadas: 0, canceladas: 1,
        estudiantesAtendidos: 2, tutoresVerificados: 3, tutoresPendientes: 1, calificacionPromedio: 5,
      })
      assert.deepEqual(Object.keys(porSede), ['Riohacha', 'Maicao', 'Villanueva', 'Fonseca'])
      assert.equal(porSede.Riohacha.solicitudes, 2) // las dos de Elena
      assert.equal(porSede.Fonseca.solicitudes, 3) // las tres de Felipe
      assert.equal(porSede.Villanueva.tutoresPendientes, 1) // Diego
      assert.equal(porSede.Maicao.calificacionPromedio, null)
      assert.doesNotMatch(JSON.stringify(respuesta.body), /@|Elena|Felipe|Andrea/)
    })
  })

  describe('Favoritos (RQF030)', () => {
    it('agrega, lista y quita tutores favoritos sin repetirlos', async () => {
      const andrea = await perfilDe(CORREOS.andrea)
      const bruno = await perfilDe(CORREOS.bruno)
      assert.deepEqual((await elena.get('/favoritos')).body, [])
      await elena.put(`/favoritos/${andrea.id}`)
      await elena.put(`/favoritos/${andrea.id}`)
      const lista = await elena.put(`/favoritos/${bruno.id}`)
      assert.equal(lista.status, 200)
      assert.deepEqual(lista.body.map((tutor) => tutor.estudiante.nombre).sort(), ['Andrea Salcedo', 'Bruno Valdés'])
      assert.doesNotMatch(JSON.stringify(lista.body), /@uniguajira/)
      const despues = await elena.delete(`/favoritos/${andrea.id}`)
      assert.deepEqual(despues.body.map((tutor) => tutor.estudiante.nombre), ['Bruno Valdés'])
    })

    it('los favoritos son de cada estudiante; no acepta tutores sin verificar ni al administrador', async () => {
      const andrea = await perfilDe(CORREOS.andrea)
      const pendiente = await perfilDe(CORREOS.diego)
      await elena.put(`/favoritos/${andrea.id}`)
      assert.deepEqual((await diego.get('/favoritos')).body, [])
      assert.equal((await elena.put(`/favoritos/${pendiente.id}`)).status, 404)
      assert.equal((await elena.put(`/favoritos/${ID_INEXISTENTE}`)).status, 404)
      assert.equal((await administrador.get('/favoritos')).status, 403)
      assert.equal((await anonimo.get('/favoritos')).status, 401)
    })
  })

  describe('Ciclo completo solo con la API', () => {
    it('A se hace tutor -> el administrador verifica -> B solicita -> A acepta y finaliza -> B califica -> cambia el promedio', async () => {
      const api = (ruta) => `/api${ruta}`
      const clave = 'CicloCompleto2026'
      const sistemas = await Programa.findOne({ nombre: 'Ingeniería de Sistemas' })
      const materia = await Materia.findOne({ codigo: 'SIS-06' })
      const franja = { dia: 'LUNES', horaInicio: '18:00', horaFin: '20:00' }
      const registro = (nombre, usuario) => request(app).post(api('/auth/registro')).send({
        nombre, correoInstitucional: `${usuario}@uniguajira.edu.co`, clave, semestre: 5, sede: 'Riohacha',
        programa: sistemas.id, aceptaTratamientoDatos: true,
      })

      // 1. A y B se registran; el administrador ingresa con su correo y contraseña.
      const a = await registro('Aurora Pinto', 'aurora.pinto')
      const b = await registro('Benjamín Ortiz', 'benjamin.ortiz')
      assert.equal(a.status, 201)
      assert.equal(b.status, 201)
      const ingresoAdmin = await request(app).post(api('/auth/ingreso')).send({ correoInstitucional: CORREOS.administrador, clave: CLAVE_DE_PRUEBA })
      assert.equal(ingresoAdmin.status, 200)
      const como = (token) => ({ Authorization: `Bearer ${token}` })
      const [tokenA, tokenB, tokenAdmin] = [a.body.token, b.body.token, ingresoAdmin.body.token]

      // 2. A activa su perfil de tutor: queda PENDIENTE y B todavía no lo encuentra.
      const perfil = await request(app).put(api('/tutores/mi-perfil')).set(como(tokenA)).send({
        biografia: 'Explico álgebra lineal con ejercicios de parciales anteriores.',
        tarifaHora: null, materias: [materia.id], disponibilidad: [franja],
      })
      assert.equal(perfil.status, 201)
      assert.equal(perfil.body.estadoVerificacion, 'PENDIENTE')
      const nombresDe = (respuesta) => respuesta.body.map((tutor) => tutor.estudiante.nombre)
      const busquedaAntes = await request(app).get(api(`/tutores?materia=${materia.id}`)).set(como(tokenB))
      assert.ok(!nombresDe(busquedaAntes).includes('Aurora Pinto'))

      // 3. El administrador lo verifica y B ya lo encuentra.
      const verificado = await request(app).patch(api(`/coordinacion/perfiles/${perfil.body.id}/verificar`)).set(como(tokenAdmin))
      assert.equal(verificado.status, 200)
      const busqueda = await request(app).get(api(`/tutores?materia=${materia.id}`)).set(como(tokenB))
      assert.ok(nombresDe(busqueda).includes('Aurora Pinto'))
      assert.equal(busqueda.body.find((tutor) => tutor.estudiante.nombre === 'Aurora Pinto').promedio, 0)

      // 4. B solicita una sesión.
      const solicitud = await request(app).post(api('/sesiones')).set(como(tokenB)).send({
        tutor: perfil.body.id, materia: materia.id, fecha: lunes(2), franja, tema: 'Matrices y sistemas de ecuaciones lineales',
      })
      assert.equal(solicitud.status, 201)
      const sesionId = solicitud.body.id

      // 5. A la ve en sus sesiones, la acepta y la finaliza.
      const deA = await request(app).get(api('/sesiones?papel=TUTOR')).set(como(tokenA))
      assert.deepEqual(deA.body.map((sesion) => sesion.id), [sesionId])
      assert.equal((await request(app).patch(api(`/sesiones/${sesionId}/confirmar`)).set(como(tokenA))).body.estado, 'CONFIRMADA')
      assert.equal((await request(app).patch(api(`/sesiones/${sesionId}/finalizar`)).set(como(tokenA))).body.estado, 'FINALIZADA')

      // 6. B califica y el promedio del tutor cambia.
      const calificada = await request(app).post(api(`/sesiones/${sesionId}/calificacion`)).set(como(tokenB)).send({ puntaje: 4, resena: 'Muy clara' })
      assert.equal(calificada.status, 201)
      const detalle = await request(app).get(api(`/tutores/${perfil.body.id}`)).set(como(tokenB))
      assert.deepEqual([detalle.body.promedio, detalle.body.totalCalificaciones, detalle.body.tutoriasCompletadas], [4, 1, 1])
      assert.equal(detalle.body.resenas[0].autor, 'Benjamín O.')
    })
  })
})
