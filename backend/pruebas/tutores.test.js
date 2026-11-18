import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { Materia, PerfilTutor, Programa, Sesion, Usuario } from '../src/models/index.js'
import { cargarSemilla } from '../src/services/semilla.service.js'
import { clienteDe, CORREOS } from './ayudas/sesion.js'

const ID_INEXISTENTE = '6728f1a2b3c4d5e6f7a8b9c0'
const nombres = (respuesta) => respuesta.body.map((tutor) => tutor.estudiante.nombre)

async function perfilDe(correo) {
  const usuario = await Usuario.findOne({ correoInstitucional: correo })
  return PerfilTutor.findOne({ estudiante: usuario._id })
}

describe('E3 · Tutores', () => {
  let anonimo, elena, andrea, diego, administrador

  before(iniciarBaseDePrueba)
  beforeEach(async () => {
    await vaciarBaseDePrueba()
    await cargarSemilla(CLAVE_DE_PRUEBA)
    anonimo = await clienteDe(null)
    elena = await clienteDe(CORREOS.elena)
    andrea = await clienteDe(CORREOS.andrea)
    diego = await clienteDe(CORREOS.diego)
    administrador = await clienteDe(CORREOS.administrador)
  })
  after(detenerBaseDePrueba)

  describe('GET /api/tutores (búsqueda)', () => {
    it('es pública: un visitante ve los tutores verificados', async () => {
      const respuesta = await anonimo.get('/tutores')
      assert.equal(respuesta.status, 200)
      assert.ok(respuesta.body.length > 0)
      assert.ok(respuesta.body.every((tutor) => tutor.estadoVerificacion === 'VERIFICADO'))
      assert.ok(respuesta.body.every((tutor) => !('correo' in tutor.estudiante) && !('telefono' in tutor.estudiante)))
    })

    it('solo devuelve tutores verificados, mejor calificados primero', async () => {
      const respuesta = await elena.get('/tutores')
      assert.equal(respuesta.status, 200)
      // Diego tiene el perfil PENDIENTE: no aparece. Carolina tiene 5.0 y va primero.
      assert.deepEqual(nombres(respuesta), ['Carolina Rueda', 'Andrea Salcedo', 'Bruno Valdés'])
      assert.ok(respuesta.body.every((tutor) => tutor.estadoVerificacion === 'VERIFICADO'))
    })

    it('no expone correo, contraseña ni datos de contacto (RQF020)', async () => {
      const respuesta = await elena.get('/tutores')
      const texto = JSON.stringify(respuesta.body)
      assert.doesNotMatch(texto, /@uniguajira|correo|clave|telefono|documento/i)
      assert.deepEqual(Object.keys(respuesta.body[0].estudiante).sort(), ['id', 'nombre', 'programa', 'sede', 'semestre'])
    })

    it('filtra por materia (RQF009)', async () => {
      const materia = await Materia.findOne({ codigo: 'SIS-04' })
      assert.deepEqual(nombres(await elena.get(`/tutores?materia=${materia.id}`)), ['Andrea Salcedo'])
      assert.deepEqual(nombres(await elena.get(`/tutores?materia=${ID_INEXISTENTE}`)), [])
    })

    it('filtra por programa, sede y día', async () => {
      const administracion = await Programa.findOne({ nombre: 'Administración de Empresas' })
      assert.deepEqual(nombres(await elena.get(`/tutores?programa=${administracion.id}`)), ['Bruno Valdés'])
      assert.deepEqual(nombres(await elena.get('/tutores?sede=Riohacha')), ['Carolina Rueda', 'Andrea Salcedo'])
      assert.equal((await elena.get('/tutores?dia=lunes')).body.length, 3)
      assert.equal((await elena.get('/tutores?dia=MARTES')).body.length, 0)
    })

    it('filtra por precio, gratuidad y calificación (RQF010)', async () => {
      assert.deepEqual(nombres(await elena.get('/tutores?soloGratuitas=true')), ['Carolina Rueda', 'Bruno Valdés'])
      assert.deepEqual(nombres(await elena.get('/tutores?precioMaximo=20000')), ['Carolina Rueda', 'Bruno Valdés'])
      assert.equal((await elena.get('/tutores?precioMaximo=35000')).body.length, 3)
      assert.deepEqual(nombres(await elena.get('/tutores?calificacionMinima=4')), ['Carolina Rueda'])
    })

    it('combina filtros', async () => {
      assert.deepEqual(nombres(await elena.get('/tutores?sede=Riohacha&soloGratuitas=true&dia=LUNES')), ['Carolina Rueda'])
    })

    it('rechaza con 400 los filtros mal escritos', async () => {
      for (const consulta of ['materia=abc', 'sede=Bogota', 'dia=FERIADO', 'precioMaximo=-1', 'calificacionMinima=9', 'soloGratuitas=si', 'dia=LUNES&dia=MARTES']) {
        const respuesta = await elena.get(`/tutores?${consulta}`)
        assert.equal(respuesta.status, 400, consulta)
        assert.ok(respuesta.body.errores.length > 0)
      }
    })

    it('calcula el promedio y las tutorías completadas a partir de las sesiones (RQF018, RQF019)', async () => {
      const antes = (await elena.get('/tutores')).body.find((tutor) => tutor.estudiante.nombre === 'Bruno Valdés')
      assert.deepEqual([antes.promedio, antes.totalCalificaciones, antes.tutoriasCompletadas], [0, 0, 1])

      // Se califica directamente en la base la sesión finalizada de Bruno: el promedio debe cambiar solo.
      const bruno = await perfilDe(CORREOS.bruno)
      await Sesion.updateOne({ tutor: bruno._id, estado: 'FINALIZADA' }, { calificacion: { puntaje: 4, resena: 'Bien' } })
      const despues = (await elena.get('/tutores')).body.find((tutor) => tutor.estudiante.nombre === 'Bruno Valdés')
      assert.deepEqual([despues.promedio, despues.totalCalificaciones, despues.tutoriasCompletadas], [4, 1, 1])
      assert.equal(Object.hasOwn((await PerfilTutor.findById(bruno._id)).toObject(), 'promedio'), false)
    })
  })

  describe('GET /api/tutores/:id (perfil público)', () => {
    it('muestra biografía, materias, tarifa, disponibilidad, promedio y reseñas (RQF011)', async () => {
      const carolina = await perfilDe(CORREOS.carolina)
      const respuesta = await elena.get(`/tutores/${carolina.id}`)
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.estudiante.nombre, 'Carolina Rueda')
      assert.equal(respuesta.body.materias.length, 8)
      assert.equal(respuesta.body.tarifaHora, null)
      assert.deepEqual(respuesta.body.disponibilidad, [{ dia: 'LUNES', horaInicio: '14:00', horaFin: '16:00' }])
      assert.equal(respuesta.body.promedio, 5)
      assert.equal(respuesta.body.resenas.length, 1)
      assert.equal(respuesta.body.resenas[0].autor, 'Elena L.')
      assert.equal(respuesta.body.resenas[0].materia, 'Biología Celular')
      assert.equal(respuesta.body.motivoRechazo, undefined)
      assert.doesNotMatch(JSON.stringify(respuesta.body), /@uniguajira|correo|clave/i)
    })

    it('un perfil sin verificar no existe para los demás, pero sí para su dueño y el administrador', async () => {
      const pendiente = await perfilDe(CORREOS.diego)
      assert.equal((await elena.get(`/tutores/${pendiente.id}`)).status, 404)
      assert.equal((await diego.get(`/tutores/${pendiente.id}`)).status, 200)
      assert.equal((await administrador.get(`/tutores/${pendiente.id}`)).status, 200)
    })

    it('responde 404 si no existe y 400 si el id está mal formado; el visitante no ve perfiles pendientes', async () => {
      assert.equal((await elena.get(`/tutores/${ID_INEXISTENTE}`)).status, 404)
      assert.equal((await elena.get('/tutores/123')).status, 400)
      assert.equal((await anonimo.get(`/tutores/${ID_INEXISTENTE}`)).status, 404)
      assert.equal((await anonimo.get(`/tutores/${(await perfilDe(CORREOS.diego)).id}`)).status, 404)
    })
  })

  describe('Perfil de tutor propio', () => {
    let materias
    const datosPerfil = (cambios = {}) => ({
      biografia: 'Explico cálculo y programación con ejercicios resueltos paso a paso.',
      tarifaHora: null,
      materias: materias.map((materia) => materia.id),
      disponibilidad: [
        { dia: 'MARTES', horaInicio: '08:00', horaFin: '10:00' },
        { dia: 'JUEVES', horaInicio: '14:00', horaFin: '16:00' },
      ],
      ...cambios,
    })

    beforeEach(async () => {
      materias = await Materia.find({ codigo: { $in: ['SIS-01', 'SIS-04'] } })
    })

    it('GET responde 404 si el estudiante no ha activado su perfil', async () => {
      assert.equal((await elena.get('/tutores/mi-perfil')).status, 404)
    })

    it('PUT activa el perfil: nace PENDIENTE y no aparece en la búsqueda (RQF006, RQF007)', async () => {
      const respuesta = await elena.put('/tutores/mi-perfil', datosPerfil())
      assert.equal(respuesta.status, 201)
      assert.equal(respuesta.body.estadoVerificacion, 'PENDIENTE')
      assert.equal(respuesta.body.estudiante.nombre, 'Elena Lozano')
      assert.equal(respuesta.body.materias.length, 2)
      assert.equal(respuesta.body.disponibilidad.length, 2)
      assert.equal(respuesta.body.tarifaHora, null)
      assert.equal((await elena.get('/tutores/mi-perfil')).status, 200)
      assert.ok(!nombres(await andrea.get('/tutores')).includes('Elena Lozano'))
    })

    it('PUT guarda cambios del perfil existente sin perder la verificación (RQF026)', async () => {
      const respuesta = await andrea.put('/tutores/mi-perfil', datosPerfil({ tarifaHora: 28000 }))
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.tarifaHora, 28000)
      assert.equal(respuesta.body.estadoVerificacion, 'VERIFICADO')
      assert.equal(respuesta.body.materias.length, 2)
      assert.equal(await PerfilTutor.countDocuments(), 4)
    })

    it('nadie puede verificarse a sí mismo ni cambiar de dueño el perfil', async () => {
      const otro = await Usuario.findOne({ correoInstitucional: CORREOS.felipe })
      const respuesta = await elena.put('/tutores/mi-perfil', datosPerfil({ estadoVerificacion: 'VERIFICADO', estudiante: otro.id }))
      assert.equal(respuesta.status, 201)
      assert.equal(respuesta.body.estadoVerificacion, 'PENDIENTE')
      assert.equal(respuesta.body.estudiante.nombre, 'Elena Lozano')
      assert.equal(await PerfilTutor.countDocuments({ estudiante: otro._id }), 0)
    })

    it('un perfil rechazado vuelve a revisión al corregirse', async () => {
      const perfil = await perfilDe(CORREOS.diego)
      await PerfilTutor.updateOne({ _id: perfil._id }, { estadoVerificacion: 'RECHAZADO', motivoRechazo: 'Falta el soporte académico' })
      assert.equal((await diego.get('/tutores/mi-perfil')).body.motivoRechazo, 'Falta el soporte académico')
      const respuesta = await diego.put('/tutores/mi-perfil', datosPerfil({ materias: [] }))
      assert.equal(respuesta.body.estadoVerificacion, 'PENDIENTE')
      assert.equal(respuesta.body.motivoRechazo, null)
    })

    it('rechaza con 400 franjas que se solapan (R9)', async () => {
      const respuesta = await elena.put('/tutores/mi-perfil', datosPerfil({
        disponibilidad: [
          { dia: 'MARTES', horaInicio: '08:00', horaFin: '10:00' },
          { dia: 'MARTES', horaInicio: '09:30', horaFin: '11:00' },
        ],
      }))
      assert.equal(respuesta.status, 400)
      assert.match(respuesta.body.errores[0], /solapa/)
      assert.equal(await PerfilTutor.countDocuments(), 4)
    })

    it('rechaza con 400 franjas mal formadas', async () => {
      for (const franja of [
        { dia: 'FERIADO', horaInicio: '08:00', horaFin: '10:00' },
        { dia: 'MARTES', horaInicio: '8:00', horaFin: '10:00' },
        { dia: 'MARTES', horaInicio: '10:00', horaFin: '08:00' },
        { dia: 'MARTES', horaInicio: '25:00', horaFin: '26:00' },
        'LUNES 08:00',
      ]) {
        const respuesta = await elena.put('/tutores/mi-perfil', datosPerfil({ disponibilidad: [franja] }))
        assert.equal(respuesta.status, 400, JSON.stringify(franja))
      }
    })

    it('rechaza con 400 y mensaje en español las franjas cuyos datos no son texto', async () => {
      for (const franja of [
        { dia: 'MARTES', horaInicio: ['08:00'], horaFin: '10:00' },
        { dia: 'MARTES', horaInicio: '08:00', horaFin: ['10:00'] },
        { dia: 'MARTES', horaInicio: { toString: '08:00' }, horaFin: '10:00' },
        { dia: 'MARTES', horaInicio: '08:00', horaFin: { toString: '10:00' } },
        { dia: ['MARTES'], horaInicio: '08:00', horaFin: '10:00' },
        { dia: { toString: 'MARTES' }, horaInicio: '08:00', horaFin: '10:00' },
        { dia: 'MARTES', horaInicio: 800, horaFin: 1000 },
        { dia: 'MARTES', horaInicio: null, horaFin: '10:00' },
        null,
        ['MARTES', '08:00', '10:00'],
      ]) {
        const respuesta = await elena.put('/tutores/mi-perfil', datosPerfil({ disponibilidad: [franja] }))
        assert.equal(respuesta.status, 400, JSON.stringify(franja))
        assert.match(respuesta.body.errores[0], /Cada franja necesita un día válido/)
        assert.doesNotMatch(JSON.stringify(respuesta.body), /Cast|failed|model/)
      }
      assert.equal(await PerfilTutor.countDocuments(), 4)
    })

    it('rechaza con 400 los demás campos con un tipo que no corresponde, sin errores internos', async () => {
      for (const cambios of [
        { biografia: ['Explico cálculo y programación con ejercicios resueltos.'] },
        { biografia: { toString: 'x' } },
        { tarifaHora: [20000] },
        { tarifaHora: { valor: 20000 } },
        { materias: 'no-es-una-lista' },
        { materias: [{ id: 'x' }] },
        { materias: [null] },
        { disponibilidad: 'LUNES' },
        { disponibilidad: { dia: 'LUNES' } },
      ]) {
        const respuesta = await elena.put('/tutores/mi-perfil', datosPerfil(cambios))
        assert.equal(respuesta.status, 400, JSON.stringify(cambios))
        assert.doesNotMatch(JSON.stringify(respuesta.body), /Cast|failed|Error interno/)
      }
    })

    it('dos activaciones simultáneas del mismo perfil dejan uno solo, y ambas respuestas están documentadas', async () => {
      const { afirmarContrato } = await import('./ayudas/contrato.js')
      const respuestas = await Promise.all([
        elena.put('/tutores/mi-perfil', datosPerfil()),
        elena.put('/tutores/mi-perfil', datosPerfil()),
        elena.put('/tutores/mi-perfil', datosPerfil()),
      ])
      for (const respuesta of respuestas) {
        assert.ok([200, 201, 409].includes(respuesta.status), `estado ${respuesta.status}`)
        await afirmarContrato(respuesta, '/tutores/mi-perfil', 'put')
      }
      assert.equal(respuestas.filter((respuesta) => respuesta.status === 201).length, 1)
      const dueno = await Usuario.findOne({ correoInstitucional: CORREOS.elena })
      assert.equal(await PerfilTutor.countDocuments({ estudiante: dueno._id }), 1)
    })

    it('rechaza con 400 una tarifa no válida (R10) y una biografía corta', async () => {
      for (const tarifaHora of [0, -5000, '35000', 900000]) {
        assert.equal((await elena.put('/tutores/mi-perfil', datosPerfil({ tarifaHora }))).status, 400, String(tarifaHora))
      }
      assert.equal((await elena.put('/tutores/mi-perfil', datosPerfil({ biografia: 'Muy corta' }))).status, 400)
    })

    it('rechaza con 400 materias inexistentes, retiradas o repetidas', async () => {
      const [primera] = materias
      assert.equal((await elena.put('/tutores/mi-perfil', datosPerfil({ materias: [ID_INEXISTENTE] }))).status, 400)
      assert.equal((await elena.put('/tutores/mi-perfil', datosPerfil({ materias: [primera.id, primera.id] }))).status, 400)
      assert.equal((await elena.put('/tutores/mi-perfil', datosPerfil({ materias: ['abc'] }))).status, 400)
      await Materia.updateOne({ _id: primera._id }, { activa: false })
      assert.equal((await elena.put('/tutores/mi-perfil', datosPerfil())).status, 400)
    })

    it('el administrador no tiene perfil de tutor: 403', async () => {
      assert.equal((await administrador.get('/tutores/mi-perfil')).status, 403)
      assert.equal((await administrador.put('/tutores/mi-perfil', datosPerfil())).status, 403)
    })

    it('sin sesión responde 401', async () => {
      assert.equal((await anonimo.put('/tutores/mi-perfil', datosPerfil())).status, 401)
    })
  })

  describe('PATCH /api/auth/yo (edición de la cuenta, RQF026)', () => {
    it('el estudiante no puede cambiar nombre, semestre, sede ni programa: los pone la Universidad', async () => {
      const biologia = await Programa.findOne({ nombre: 'Biología' })
      for (const cambio of [{ nombre: 'Elena Lozano Pérez' }, { semestre: 3 }, { sede: 'Maicao' }, { programa: biologia.id }]) {
        assert.equal((await elena.patch('/auth/yo', cambio)).status, 403)
      }
      const cuenta = (await elena.get('/auth/yo')).body.usuario
      assert.deepEqual([cuenta.nombre, cuenta.sede], ['Elena Lozano', 'Riohacha'])
    })

    it('no deja cambiar el correo, el rol ni la contraseña', async () => {
      const respuesta = await administrador.patch('/auth/yo', {
        nombre: 'Gabriela Montes',
        correoInstitucional: 'otra@uniguajira.edu.co',
        tipo: 'ESTUDIANTE',
        claveHash: 'x',
      })
      assert.equal(respuesta.status, 200)
      assert.equal(respuesta.body.usuario.correoInstitucional, CORREOS.administrador)
      assert.equal(respuesta.body.usuario.tipo, 'ADMINISTRADOR')
    })

    it('rechaza con 400 datos no válidos o un cuerpo sin cambios', async () => {
      assert.equal((await elena.patch('/auth/yo', {})).status, 400)
      assert.equal((await administrador.patch('/auth/yo', {})).status, 400)
      assert.equal((await administrador.patch('/auth/yo', { nombre: 'ab' })).status, 400)
      assert.equal((await administrador.patch('/auth/yo', { dependencia: 'x' })).status, 400)
    })

    it('el administrador cambia su nombre y dependencia; sin sesión responde 401', async () => {
      const respuesta = await administrador.patch('/auth/yo', { dependencia: 'Área de Permanencia y Graduación Exitosa' })
      assert.equal(respuesta.body.usuario.dependencia, 'Área de Permanencia y Graduación Exitosa')
      assert.equal((await anonimo.patch('/auth/yo', { nombre: 'Sin sesión' })).status, 401)
    })
  })
})
