import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import { after, before, beforeEach, describe, it } from 'node:test'
import { Materia, PerfilTutor, Programa, Usuario } from '../src/models/index.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { afirmarContrato } from './ayudas/contrato.js'
import { clienteDe, CORREOS } from './ayudas/sesion.js'

const ID_INEXISTENTE = '6728f1a2b3c4d5e6f7a8b9c0'

async function perfilDe(correo) {
  const usuario = await Usuario.findOne({ correoInstitucional: correo })
  return PerfilTutor.findOne({ estudiante: usuario._id })
}

describe('E3 · Las respuestas reales cumplen lo que publica Swagger', () => {
  let anonimo, elena, andrea, administrador, sistemas, materia

  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    anonimo = await clienteDe(null)
    elena = await clienteDe(CORREOS.elena)
    andrea = await clienteDe(CORREOS.andrea)
    administrador = await clienteDe(CORREOS.administrador)
    sistemas = await Programa.findOne({ nombre: 'Ingeniería de Sistemas' })
    materia = await Materia.findOne({ codigo: 'SIS-04' })
  })
  after(detenerBaseDePrueba)

  it('catálogo: programas y materias, con sus errores', async () => {
    await afirmarContrato(await anonimo.get('/programas'), '/programas', 'get')
    await afirmarContrato(await anonimo.get('/materias'), '/materias', 'get')
    await afirmarContrato(await anonimo.get('/materias?programa=abc'), '/materias', 'get')
    await afirmarContrato(await anonimo.get(`/materias/${materia.id}`), '/materias/{id}', 'get')
    await afirmarContrato(await anonimo.get(`/materias/${ID_INEXISTENTE}`), '/materias/{id}', 'get')
    await afirmarContrato(await anonimo.get('/materias/abc'), '/materias/{id}', 'get')

    const nueva = { codigo: 'SIS-99', nombre: 'Bases de Datos I', programa: sistemas.id }
    await afirmarContrato(await administrador.post('/materias', nueva), '/materias', 'post')
    await afirmarContrato(await administrador.post('/materias', nueva), '/materias', 'post') // 409
    await afirmarContrato(await administrador.post('/materias', {}), '/materias', 'post') // 400
    await afirmarContrato(await elena.post('/materias', nueva), '/materias', 'post') // 403
    await afirmarContrato(await anonimo.post('/materias', nueva), '/materias', 'post') // 401

    await afirmarContrato(await administrador.put(`/materias/${materia.id}`, { nombre: 'Algoritmos I' }), '/materias/{id}', 'put')
    await afirmarContrato(await administrador.put(`/materias/${materia.id}`, {}), '/materias/{id}', 'put')
    await afirmarContrato(await administrador.put(`/materias/${materia.id}`, { codigo: 'SIS-05' }), '/materias/{id}', 'put')
    await afirmarContrato(await administrador.put(`/materias/${ID_INEXISTENTE}`, { nombre: 'Otra materia' }), '/materias/{id}', 'put')
    await afirmarContrato(await elena.put(`/materias/${materia.id}`, { nombre: 'Otra materia' }), '/materias/{id}', 'put')

    await afirmarContrato(await administrador.delete(`/materias/${materia.id}`), '/materias/{id}', 'delete')
    await afirmarContrato(await administrador.delete(`/materias/${ID_INEXISTENTE}`), '/materias/{id}', 'delete')
    await afirmarContrato(await elena.delete(`/materias/${materia.id}`), '/materias/{id}', 'delete')
    await afirmarContrato(await anonimo.delete(`/materias/${materia.id}`), '/materias/{id}', 'delete')
  })

  it('catálogo: crear, consultar, editar y borrar facultades, con sus errores', async () => {
    await afirmarContrato(await anonimo.get('/facultades'), '/facultades', 'get')
    const nueva = { nombre: 'Facultad de Pruebas' }
    const creada = await administrador.post('/facultades', nueva)
    await afirmarContrato(creada, '/facultades', 'post') // 201
    await afirmarContrato(await administrador.post('/facultades', nueva), '/facultades', 'post') // 409
    await afirmarContrato(await administrador.post('/facultades', {}), '/facultades', 'post') // 400
    await afirmarContrato(await elena.post('/facultades', nueva), '/facultades', 'post') // 403
    await afirmarContrato(await anonimo.post('/facultades', nueva), '/facultades', 'post') // 401

    const id = creada.body.id
    await afirmarContrato(await anonimo.get(`/facultades/${id}`), '/facultades/{id}', 'get')
    await afirmarContrato(await anonimo.get(`/facultades/${ID_INEXISTENTE}`), '/facultades/{id}', 'get')
    await afirmarContrato(await anonimo.get('/facultades/abc'), '/facultades/{id}', 'get')
    await afirmarContrato(await administrador.put(`/facultades/${id}`, { nombre: 'Facultad de Ensayos' }), '/facultades/{id}', 'put')
    await afirmarContrato(await administrador.put(`/facultades/${id}`, {}), '/facultades/{id}', 'put') // 400
    await afirmarContrato(await administrador.put(`/facultades/${id}`, { nombre: 'Facultad de Ingeniería' }), '/facultades/{id}', 'put') // 409
    await afirmarContrato(await administrador.put(`/facultades/${ID_INEXISTENTE}`, { nombre: 'Otra facultad' }), '/facultades/{id}', 'put') // 404
    await afirmarContrato(await elena.put(`/facultades/${id}`, { nombre: 'Otra facultad' }), '/facultades/{id}', 'put') // 403

    const ingenieria = (await anonimo.get('/facultades')).body.find(({ nombre }) => nombre === 'Facultad de Ingeniería')
    await afirmarContrato(await administrador.delete(`/facultades/${ingenieria.id}`), '/facultades/{id}', 'delete') // 409
    await afirmarContrato(await elena.delete(`/facultades/${id}`), '/facultades/{id}', 'delete') // 403
    await afirmarContrato(await anonimo.delete(`/facultades/${id}`), '/facultades/{id}', 'delete') // 401
    await afirmarContrato(await administrador.delete(`/facultades/${id}`), '/facultades/{id}', 'delete') // 200
    await afirmarContrato(await administrador.delete(`/facultades/${id}`), '/facultades/{id}', 'delete') // 404
    await afirmarContrato(await administrador.delete('/facultades/abc'), '/facultades/{id}', 'delete') // 400
  })

  it('catálogo: crear, consultar, editar y borrar programas, con sus errores', async () => {
    const nuevo = { nombre: 'Ingeniería Agroindustrial', facultad: 'Facultad de Ingeniería' }
    const creado = await administrador.post('/programas', nuevo)
    await afirmarContrato(creado, '/programas', 'post') // 201
    await afirmarContrato(await administrador.post('/programas', nuevo), '/programas', 'post') // 409
    await afirmarContrato(await administrador.post('/programas', {}), '/programas', 'post') // 400
    await afirmarContrato(await elena.post('/programas', nuevo), '/programas', 'post') // 403
    await afirmarContrato(await anonimo.post('/programas', nuevo), '/programas', 'post') // 401

    const id = creado.body.id
    await afirmarContrato(await anonimo.get(`/programas/${id}`), '/programas/{id}', 'get')
    await afirmarContrato(await anonimo.get(`/programas/${ID_INEXISTENTE}`), '/programas/{id}', 'get')
    await afirmarContrato(await anonimo.get('/programas/abc'), '/programas/{id}', 'get')

    await afirmarContrato(await administrador.put(`/programas/${id}`, { facultad: 'Facultad de Ciencias Básicas y Aplicadas' }), '/programas/{id}', 'put')
    await afirmarContrato(await administrador.put(`/programas/${id}`, {}), '/programas/{id}', 'put') // 400
    await afirmarContrato(await administrador.put(`/programas/${id}`, { nombre: 'Ingeniería de Sistemas' }), '/programas/{id}', 'put') // 409
    await afirmarContrato(await administrador.put(`/programas/${ID_INEXISTENTE}`, { nombre: 'Otro programa' }), '/programas/{id}', 'put') // 404
    await afirmarContrato(await elena.put(`/programas/${id}`, { nombre: 'Otro programa' }), '/programas/{id}', 'put') // 403

    await afirmarContrato(await administrador.delete(`/programas/${sistemas.id}`), '/programas/{id}', 'delete') // 409
    await afirmarContrato(await elena.delete(`/programas/${id}`), '/programas/{id}', 'delete') // 403
    await afirmarContrato(await anonimo.delete(`/programas/${id}`), '/programas/{id}', 'delete') // 401
    await afirmarContrato(await administrador.delete(`/programas/${id}`), '/programas/{id}', 'delete') // 200
    await afirmarContrato(await administrador.delete(`/programas/${id}`), '/programas/{id}', 'delete') // 404
    await afirmarContrato(await administrador.delete('/programas/abc'), '/programas/{id}', 'delete') // 400
  })

  it('tutores: búsqueda, perfil público y perfil propio, con sus errores', async () => {
    await afirmarContrato(await elena.get('/tutores'), '/tutores', 'get')
    await afirmarContrato(await elena.get('/tutores?sede=Bogota'), '/tutores', 'get')
    await afirmarContrato(await anonimo.get('/tutores'), '/tutores', 'get')

    const carolina = await perfilDe(CORREOS.carolina)
    const pendiente = await perfilDe(CORREOS.diego)
    await afirmarContrato(await elena.get(`/tutores/${carolina.id}`), '/tutores/{id}', 'get')
    await afirmarContrato(await administrador.get(`/tutores/${pendiente.id}`), '/tutores/{id}', 'get')
    await afirmarContrato(await elena.get(`/tutores/${pendiente.id}`), '/tutores/{id}', 'get')
    await afirmarContrato(await elena.get('/tutores/abc'), '/tutores/{id}', 'get')

    await afirmarContrato(await andrea.get('/tutores/mi-perfil'), '/tutores/mi-perfil', 'get')
    await afirmarContrato(await elena.get('/tutores/mi-perfil'), '/tutores/mi-perfil', 'get') // 404
    await afirmarContrato(await administrador.get('/tutores/mi-perfil'), '/tutores/mi-perfil', 'get') // 403

    const datos = {
      biografia: 'Explico cálculo y programación con ejercicios resueltos.',
      tarifaHora: 20000,
      materias: [materia.id],
      disponibilidad: [{ dia: 'MARTES', horaInicio: '08:00', horaFin: '10:00' }],
    }
    await afirmarContrato(await elena.put('/tutores/mi-perfil', datos), '/tutores/mi-perfil', 'put') // 201
    await afirmarContrato(await elena.put('/tutores/mi-perfil', { ...datos, tarifaHora: null }), '/tutores/mi-perfil', 'put') // 200
    await afirmarContrato(await elena.put('/tutores/mi-perfil', { ...datos, tarifaHora: 0 }), '/tutores/mi-perfil', 'put') // 400
    await afirmarContrato(await administrador.put('/tutores/mi-perfil', datos), '/tutores/mi-perfil', 'put') // 403
    await afirmarContrato(await anonimo.put('/tutores/mi-perfil', datos), '/tutores/mi-perfil', 'put') // 401
  })

  it('edición de la cuenta propia', async () => {
    await afirmarContrato(await elena.patch('/auth/yo', { semestre: 3 }), '/auth/yo', 'patch')
    await afirmarContrato(await administrador.patch('/auth/yo', { nombre: 'Gabriela Montes Ruiz' }), '/auth/yo', 'patch')
    await afirmarContrato(await elena.patch('/auth/yo', {}), '/auth/yo', 'patch')
    await afirmarContrato(await anonimo.patch('/auth/yo', { semestre: 3 }), '/auth/yo', 'patch')
  })
})
