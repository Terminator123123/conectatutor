import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { MATERIAS, PROGRAMAS } from '../src/datos/catalogoUniguajira.js'
import { Materia, PerfilTutor, Programa } from '../src/models/index.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { clienteDe, CORREOS } from './ayudas/sesion.js'

const ID_INEXISTENTE = '6728f1a2b3c4d5e6f7a8b9c0'
const DE_SISTEMAS = MATERIAS.filter(({ programa }) => programa === 'Ingeniería de Sistemas').length

describe('E3 · Catálogo: programas y materias', () => {
  let anonimo, estudiante, administrador, sistemas

  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    anonimo = await clienteDe(null)
    estudiante = await clienteDe(CORREOS.elena)
    administrador = await clienteDe(CORREOS.administrador)
    sistemas = await Programa.findOne({ nombre: 'Ingeniería de Sistemas' })
  })
  after(detenerBaseDePrueba)

  describe('Lectura', () => {
    it('GET /api/programas lista los programas sin pedir sesión', async () => {
      const respuesta = await anonimo.get('/programas')
      assert.equal(respuesta.status, 200)
      // El servidor ordena por nombre con el orden binario de MongoDB, el mismo de sort() sin comparador
      assert.deepEqual(respuesta.body.map((programa) => programa.nombre), PROGRAMAS.map((programa) => programa.nombre).sort())
      assert.ok(respuesta.body[0].id)
    })

    it('GET /api/materias lista las materias activas con su programa', async () => {
      const respuesta = await anonimo.get('/materias')
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.length, MATERIAS.length)
      assert.equal(respuesta.body[0].programa.nombre, 'Administración de Empresas')
    })

    it('filtra las materias por programa', async () => {
      const respuesta = await anonimo.get(`/materias?programa=${sistemas.id}`)
      assert.equal(respuesta.body.length, DE_SISTEMAS)
      assert.ok(respuesta.body.every((materia) => materia.codigo.startsWith('SIS-')))
      assert.equal((await anonimo.get('/materias?programa=abc')).status, 400)
    })

    it('GET /api/materias/:id responde 404 si no existe y 400 si el id está mal formado', async () => {
      const materia = await Materia.findOne({ codigo: 'SIS-04' })
      assert.equal((await anonimo.get(`/materias/${materia.id}`)).body.nombre, 'Algoritmo y Programación I')
      assert.equal((await anonimo.get(`/materias/${ID_INEXISTENTE}`)).status, 404)
      assert.equal((await anonimo.get('/materias/123')).status, 400)
    })
  })

  describe('Programas: CRUD del administrador', () => {
    const nuevo = () => ({ nombre: '  Ingeniería   Agroindustrial ', facultad: 'Facultad de Ingeniería' })

    it('crea un programa con el nombre limpio y aparece en la lista pública', async () => {
      const respuesta = await administrador.post('/programas', nuevo())
      assert.equal(respuesta.status, 201)
      assert.equal(respuesta.body.nombre, 'Ingeniería Agroindustrial')
      assert.equal(respuesta.body.facultad, 'Facultad de Ingeniería')
      assert.equal((await anonimo.get('/programas')).body.length, PROGRAMAS.length + 1)
      assert.equal((await anonimo.get(`/programas/${respuesta.body.id}`)).body.nombre, 'Ingeniería Agroindustrial')
    })

    it('rechaza datos incompletos y un nombre repetido', async () => {
      const vacio = await administrador.post('/programas', { nombre: 'ab' })
      assert.equal(vacio.status, 400)
      assert.equal(vacio.body.errores.length, 2)
      const repetido = await administrador.post('/programas', { nombre: 'Ingeniería de Sistemas', facultad: 'Facultad de Ingeniería' })
      assert.equal(repetido.status, 409)
      assert.match(repetido.body.mensaje, /Ingeniería de Sistemas/)
    })

    it('edita solo los campos enviados', async () => {
      const { body } = await administrador.post('/programas', nuevo())
      const editado = await administrador.put(`/programas/${body.id}`, { facultad: 'Facultad de Ciencias Básicas y Aplicadas' })
      assert.equal(editado.status, 200)
      assert.equal(editado.body.nombre, 'Ingeniería Agroindustrial')
      assert.equal(editado.body.facultad, 'Facultad de Ciencias Básicas y Aplicadas')
      assert.equal((await administrador.put(`/programas/${body.id}`, { nombre: 'Ingeniería de Sistemas' })).status, 409)
    })

    it('borra un programa sin uso, pero no uno con materias o estudiantes', async () => {
      const { body } = await administrador.post('/programas', nuevo())
      const enUso = await administrador.delete(`/programas/${sistemas.id}`)
      assert.equal(enUso.status, 409)
      assert.ok(await Programa.exists({ _id: sistemas._id }))
      assert.equal((await administrador.delete(`/programas/${body.id}`)).status, 200)
      assert.equal((await anonimo.get(`/programas/${body.id}`)).status, 404)
    })

    it('solo el administrador puede cambiar programas', async () => {
      assert.equal((await anonimo.post('/programas', nuevo())).status, 401)
      assert.equal((await estudiante.post('/programas', nuevo())).status, 403)
      assert.equal((await estudiante.put(`/programas/${sistemas.id}`, { nombre: 'Otro nombre' })).status, 403)
      assert.equal((await estudiante.delete(`/programas/${sistemas.id}`)).status, 403)
    })
  })

  describe('CRUD del administrador (RQF027)', () => {
    const nueva = () => ({ codigo: 'sis-99', nombre: '  Bases de   Datos I ', programa: sistemas.id })

    it('crea una materia: código en mayúsculas, nombre limpio y activa', async () => {
      const respuesta = await administrador.post('/materias', nueva())
      assert.equal(respuesta.status, 201)
      assert.equal(respuesta.body.codigo, 'SIS-99')
      assert.equal(respuesta.body.nombre, 'Bases de Datos I')
      assert.equal(respuesta.body.activa, true)
      assert.equal(respuesta.body.programa.nombre, 'Ingeniería de Sistemas')
      assert.equal((await anonimo.get('/materias')).body.length, MATERIAS.length + 1)
    })

    it('rechaza con 409 un código repetido', async () => {
      const respuesta = await administrador.post('/materias', { ...nueva(), codigo: 'SIS-04' })
      assert.equal(respuesta.status, 409)
      assert.match(respuesta.body.mensaje, /SIS-04/)
    })

    it('rechaza con 400 datos incompletos, mal formados o un programa que no existe', async () => {
      const vacia = await administrador.post('/materias', {})
      assert.equal(vacia.status, 400)
      assert.equal(vacia.body.errores.length, 3)
      assert.equal((await administrador.post('/materias', { ...nueva(), nombre: 'ab' })).status, 400)
      assert.equal((await administrador.post('/materias', { ...nueva(), codigo: 'con espacios' })).status, 400)
      assert.equal((await administrador.post('/materias', { ...nueva(), programa: ID_INEXISTENTE })).status, 400)
    })

    it('edita solo los campos enviados', async () => {
      const materia = await Materia.findOne({ codigo: 'SIS-04' })
      const respuesta = await administrador.put(`/materias/${materia.id}`, { nombre: 'Algoritmos y Programación I' })
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.nombre, 'Algoritmos y Programación I')
      assert.equal(respuesta.body.codigo, 'SIS-04')
      assert.equal((await administrador.put(`/materias/${materia.id}`, {})).status, 400)
      assert.equal((await administrador.put(`/materias/${materia.id}`, { codigo: 'SIS-05' })).status, 409)
      assert.equal((await administrador.put(`/materias/${ID_INEXISTENTE}`, { nombre: 'Otra materia' })).status, 404)
    })

    it('desactiva una materia: sale del catálogo y de los perfiles, pero no se borra', async () => {
      const materia = await Materia.findOne({ codigo: 'SIS-04' })
      assert.equal(await PerfilTutor.countDocuments({ materias: materia._id }), 1)

      const respuesta = await administrador.delete(`/materias/${materia.id}`)
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.activa, false)

      assert.equal((await anonimo.get('/materias')).body.length, MATERIAS.length - 1)
      assert.equal(await PerfilTutor.countDocuments({ materias: materia._id }), 0)
      assert.equal((await Materia.findById(materia.id)).activa, false)
    })

    it('las materias retiradas solo las ve el administrador, y puede reactivarlas', async () => {
      const materia = await Materia.findOne({ codigo: 'SIS-04' })
      await administrador.delete(`/materias/${materia.id}`)

      assert.equal((await administrador.get('/materias?incluirInactivas=true')).body.length, MATERIAS.length)
      assert.equal((await estudiante.get('/materias?incluirInactivas=true')).body.length, MATERIAS.length - 1)
      assert.equal((await anonimo.get('/materias?incluirInactivas=true')).body.length, MATERIAS.length - 1)

      const reactivada = await administrador.put(`/materias/${materia.id}`, { activa: true })
      assert.equal(reactivada.body.activa, true)
      assert.equal((await anonimo.get('/materias')).body.length, MATERIAS.length)
    })
  })

  describe('Permisos', () => {
    it('sin sesión responde 401 al crear, editar o desactivar', async () => {
      const materia = await Materia.findOne({ codigo: 'SIS-04' })
      assert.equal((await anonimo.post('/materias', { codigo: 'X-1', nombre: 'Materia', programa: sistemas.id })).status, 401)
      assert.equal((await anonimo.put(`/materias/${materia.id}`, { nombre: 'Cambiada' })).status, 401)
      assert.equal((await anonimo.delete(`/materias/${materia.id}`)).status, 401)
    })

    it('un estudiante recibe 403 al crear, editar o desactivar', async () => {
      const materia = await Materia.findOne({ codigo: 'SIS-04' })
      assert.equal((await estudiante.post('/materias', { codigo: 'X-1', nombre: 'Materia', programa: sistemas.id })).status, 403)
      assert.equal((await estudiante.put(`/materias/${materia.id}`, { nombre: 'Cambiada' })).status, 403)
      assert.equal((await estudiante.delete(`/materias/${materia.id}`)).status, 403)
      assert.equal((await Materia.findById(materia.id)).nombre, 'Algoritmo y Programación I')
    })

    it('un token inválido en una ruta pública responde 401 en lugar de ignorarse', async () => {
      const { default: request } = await import('supertest')
      const { app } = await import('../src/app.js')
      const respuesta = await request(app).get('/api/materias').set('Authorization', 'Bearer roto')
      assert.equal(respuesta.status, 401)
    })
  })
})
