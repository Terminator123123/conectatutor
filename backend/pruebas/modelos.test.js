import { detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { Administrador, Estudiante, Materia, PerfilTutor, Programa, Sesion, Usuario } from '../src/models/index.js'

const HASH_FALSO = '$2b$10$abcdefghijklmnopqrstuuJ8m1Yk0q1r2s3t4u5v6w7x8y9z0ABCDE'

/** Crea un programa, una materia, dos estudiantes y un perfil de tutor verificado. */
async function crearEscenario() {
  const programa = await Programa.create({ nombre: 'Ingeniería de Sistemas', facultad: 'Facultad de Ingeniería' })
  const materia = await Materia.create({ codigo: 'sis-04', nombre: 'Algoritmo y Programación I', programa: programa._id })
  const datosEstudiante = { semestre: 4, sede: 'Riohacha', programa: programa._id, claveHash: HASH_FALSO }
  const tutor = await Estudiante.create({ ...datosEstudiante, nombre: 'Andrea Salcedo', correoInstitucional: 'andrea.salcedo@uniguajira.edu.co' })
  const solicitante = await Estudiante.create({ ...datosEstudiante, nombre: 'Elena Lozano', correoInstitucional: 'elena.lozano@uniguajira.edu.co' })
  const perfil = await PerfilTutor.create({
    estudiante: tutor._id,
    biografia: 'Acompaño ejercicios de programación con ejemplos.',
    materias: [materia._id],
    disponibilidad: [{ dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00' }],
    estadoVerificacion: 'VERIFICADO',
  })
  return { programa, materia, tutor, solicitante, perfil }
}

function datosSesion({ solicitante, perfil, materia }, cambios = {}) {
  return {
    solicitante: solicitante._id,
    tutor: perfil._id,
    materia: materia._id,
    fecha: new Date('2026-11-23T00:00:00.000Z'),
    franja: { dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00' },
    tema: 'Repasar variables y estructuras de control',
    ...cambios,
  }
}

describe('E1 · Modelos', () => {
  before(iniciarBaseDePrueba)
  beforeEach(vaciarBaseDePrueba)
  after(detenerBaseDePrueba)

  describe('Usuario', () => {
    it('guarda estudiantes y administradores en una sola colección con el discriminador tipo', async () => {
      const { tutor } = await crearEscenario()
      const administrador = await Administrador.create({
        nombre: 'Gabriela Montes',
        correoInstitucional: 'gabriela.montes@uniguajira.edu.co',
        dependencia: 'Bienestar Social Universitario',
        claveHash: HASH_FALSO,
      })
      assert.equal(tutor.tipo, 'ESTUDIANTE')
      assert.equal(administrador.tipo, 'ADMINISTRADOR')
      assert.equal(await Usuario.countDocuments(), 3)
      assert.equal(await Estudiante.countDocuments(), 2)
    })

    it('rechaza un correo que no es del dominio institucional (R8)', async () => {
      const { programa } = await crearEscenario()
      await assert.rejects(
        Estudiante.create({
          nombre: 'Persona Externa',
          correoInstitucional: 'externa@gmail.com',
          semestre: 1,
          sede: 'Riohacha',
          programa: programa._id,
          claveHash: HASH_FALSO,
        }),
        /institucional/,
      )
    })

    it('no permite dos cuentas con el mismo correo', async () => {
      const { programa } = await crearEscenario()
      await assert.rejects(
        Estudiante.create({
          nombre: 'Otra Andrea',
          correoInstitucional: 'ANDREA.SALCEDO@uniguajira.edu.co',
          semestre: 2,
          sede: 'Maicao',
          programa: programa._id,
          claveHash: HASH_FALSO,
        }),
        (error) => error.code === 11000,
      )
    })

    it('nunca incluye la contraseña en el JSON ni en las consultas', async () => {
      const { tutor } = await crearEscenario()
      assert.equal(JSON.parse(JSON.stringify(tutor)).claveHash, undefined)
      const consultado = await Usuario.findById(tutor._id)
      assert.equal(consultado.claveHash, undefined)
      assert.equal(consultado.toJSON().id, String(tutor._id))
    })

    it('no deja guardar un usuario sin tipo o con un tipo que no existe', async () => {
      const datos = { nombre: 'Sin Tipo', correoInstitucional: 'sin.tipo@uniguajira.edu.co', claveHash: HASH_FALSO }
      await assert.rejects(Usuario.create(datos), /tipo/i)
      await assert.rejects(Usuario.create({ ...datos, tipo: 'EXTERNO' }), /tipo|Discriminator/i)
      assert.equal(await Usuario.countDocuments(), 0)
    })

    it('exige semestre, sede y programa al estudiante', async () => {
      await assert.rejects(
        Estudiante.create({ nombre: 'Sin Datos', correoInstitucional: 'sin.datos@uniguajira.edu.co', claveHash: HASH_FALSO }),
        (error) => ['semestre', 'sede', 'programa'].every((campo) => campo in error.errors),
      )
    })
  })

  describe('Materia', () => {
    it('guarda el código en mayúsculas, activa por defecto y sin repetir código', async () => {
      const { materia, programa } = await crearEscenario()
      assert.equal(materia.codigo, 'SIS-04')
      assert.equal(materia.activa, true)
      await assert.rejects(
        Materia.create({ codigo: 'SIS-04', nombre: 'Otra materia', programa: programa._id }),
        (error) => error.code === 11000,
      )
    })
  })

  describe('PerfilTutor', () => {
    it('rechaza dos franjas que se solapan (R9)', async () => {
      const { perfil } = await crearEscenario()
      perfil.disponibilidad.push({ dia: 'LUNES', horaInicio: '09:00', horaFin: '11:00' })
      await assert.rejects(perfil.save(), /solapar/)
    })

    it('acepta franjas contiguas y de otros días', async () => {
      const { perfil } = await crearEscenario()
      perfil.disponibilidad.push({ dia: 'LUNES', horaInicio: '10:00', horaFin: '12:00' })
      perfil.disponibilidad.push({ dia: 'MARTES', horaInicio: '08:00', horaFin: '10:00' })
      await perfil.save()
      assert.equal(perfil.disponibilidad.length, 3)
    })

    it('rechaza una franja con la hora de fin anterior a la de inicio', async () => {
      const { perfil } = await crearEscenario()
      perfil.disponibilidad.push({ dia: 'MARTES', horaInicio: '10:00', horaFin: '08:00' })
      await assert.rejects(perfil.save(), /anterior/)
    })

    it('la tarifa es null si la tutoría es gratuita o un valor mayor que cero; nunca cero ni negativa (R10)', async () => {
      const { perfil } = await crearEscenario()
      assert.equal(perfil.tarifaHora, null)

      perfil.tarifaHora = 1000
      await perfil.save()
      assert.equal((await PerfilTutor.findById(perfil._id)).tarifaHora, 1000)

      for (const tarifaHora of [0, -1, 500001]) {
        perfil.tarifaHora = tarifaHora
        await assert.rejects(perfil.save(), /tarifa/i, 'tarifa ' + tarifaHora)
      }
      assert.equal((await PerfilTutor.findById(perfil._id)).tarifaHora, 1000)

      perfil.tarifaHora = null
      await perfil.save()
      assert.equal((await PerfilTutor.findById(perfil._id)).tarifaHora, null)
    })

    it('permite un solo perfil por estudiante', async () => {
      const { tutor } = await crearEscenario()
      await assert.rejects(
        PerfilTutor.create({ estudiante: tutor._id, biografia: 'Segundo perfil del mismo estudiante.' }),
        (error) => error.code === 11000,
      )
    })
  })

  describe('Sesion', () => {
    it('nace PENDIENTE y sin calificación', async () => {
      const escenario = await crearEscenario()
      const sesion = await Sesion.create(datosSesion(escenario))
      assert.equal(sesion.estado, 'PENDIENTE')
      assert.equal(sesion.calificacion, null)
    })

    it('impide la doble reserva de la misma franja (RQNF012)', async () => {
      const escenario = await crearEscenario()
      await Sesion.create(datosSesion(escenario))
      await assert.rejects(
        Sesion.create(datosSesion(escenario, { solicitante: escenario.tutor._id })),
        (error) => error.code === 11000,
      )
    })

    it('de dos solicitudes simultáneas a la misma franja solo entra una', async () => {
      const escenario = await crearEscenario()
      const resultados = await Promise.allSettled([
        Sesion.create(datosSesion(escenario)),
        Sesion.create(datosSesion(escenario)),
        Sesion.create(datosSesion(escenario)),
      ])
      assert.equal(resultados.filter((resultado) => resultado.status === 'fulfilled').length, 1)
      assert.equal(await Sesion.countDocuments(), 1)
    })

    it('libera la franja cuando la sesión se cancela o se rechaza', async () => {
      const escenario = await crearEscenario()
      const primera = await Sesion.create(datosSesion(escenario))
      primera.estado = 'CANCELADA'
      primera.motivo = 'Cambio de planes'
      await primera.save()
      const segunda = await Sesion.create(datosSesion(escenario))
      assert.equal(segunda.estado, 'PENDIENTE')
    })

    it('solo acepta puntajes enteros de 1 a 5 (R7)', async () => {
      const escenario = await crearEscenario()
      for (const puntaje of [0, 6, 4.5]) {
        await assert.rejects(
          Sesion.create(datosSesion(escenario, { estado: 'FINALIZADA', calificacion: { puntaje } })),
          /puntaje/,
        )
      }
      const sesion = await Sesion.create(datosSesion(escenario, { estado: 'FINALIZADA', calificacion: { puntaje: 5 } }))
      assert.equal(sesion.calificacion.puntaje, 5)
    })

    it('rechaza un estado que no existe', async () => {
      const escenario = await crearEscenario()
      await assert.rejects(Sesion.create(datosSesion(escenario, { estado: 'APLAZADA' })), /Estado de sesión no válido/)
    })
  })
})
