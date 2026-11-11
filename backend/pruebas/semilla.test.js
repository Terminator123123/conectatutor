import { CLAVE_DE_PRUEBA, detenerBaseDePrueba, iniciarBaseDePrueba, vaciarBaseDePrueba } from './ayudas/base.js'

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import bcrypt from 'bcryptjs'
import { Administrador, Materia, PerfilTutor, Sesion, Usuario } from '../src/models/index.js'
import { cargarSemilla } from '../src/services/semilla.service.js'

describe('E1 · Datos de demostración (seed)', () => {
  before(iniciarBaseDePrueba)
  beforeEach(vaciarBaseDePrueba)
  after(detenerBaseDePrueba)

  it('carga programas, materias, cuentas, perfiles y sesiones', async () => {
    const totales = await cargarSemilla(CLAVE_DE_PRUEBA)
    assert.deepEqual(totales, { programas: 4, materias: 32, usuarios: 7, perfilesTutor: 4, sesiones: 5 })
  })

  it('se puede correr dos veces sin duplicar nada', async () => {
    const primera = await cargarSemilla(CLAVE_DE_PRUEBA)
    const segunda = await cargarSemilla(CLAVE_DE_PRUEBA)
    assert.deepEqual(segunda, primera)
  })

  it('restaura los datos de demostración que se hayan modificado', async () => {
    await cargarSemilla(CLAVE_DE_PRUEBA)
    await Materia.updateOne({ codigo: 'SIS-04' }, { nombre: 'Nombre cambiado', activa: false })
    await cargarSemilla(CLAVE_DE_PRUEBA)
    const materia = await Materia.findOne({ codigo: 'SIS-04' })
    assert.equal(materia.nombre, 'Algoritmo y Programación I')
    assert.equal(materia.activa, true)
  })

  it('guarda las contraseñas cifradas con bcrypt, nunca en texto', async () => {
    await cargarSemilla(CLAVE_DE_PRUEBA)
    const usuarios = await Usuario.find().select('+claveHash')
    for (const usuario of usuarios) {
      assert.notEqual(usuario.claveHash, CLAVE_DE_PRUEBA)
      assert.match(usuario.claveHash, /^\$2[aby]\$/)
    }
    assert.equal(await bcrypt.compare(CLAVE_DE_PRUEBA, usuarios[0].claveHash), true)
    assert.equal(await bcrypt.compare('OtraClave123', usuarios[0].claveHash), false)
  })

  it('deja un administrador, tres tutores verificados y uno pendiente', async () => {
    await cargarSemilla(CLAVE_DE_PRUEBA)
    assert.equal(await Administrador.countDocuments(), 1)
    assert.equal(await PerfilTutor.countDocuments({ estadoVerificacion: 'VERIFICADO' }), 3)
    assert.equal(await PerfilTutor.countDocuments({ estadoVerificacion: 'PENDIENTE' }), 1)
  })

  it('deja una sesión en cada estado del ciclo y una calificada', async () => {
    await cargarSemilla(CLAVE_DE_PRUEBA)
    const estados = (await Sesion.find()).map((sesion) => sesion.estado).sort()
    assert.deepEqual(estados, ['CANCELADA', 'CONFIRMADA', 'FINALIZADA', 'FINALIZADA', 'PENDIENTE'])
    assert.equal(await Sesion.countDocuments({ 'calificacion.puntaje': 5 }), 1)
  })

  it('rechaza una contraseña de demostración débil', async () => {
    await assert.rejects(cargarSemilla('123'), /CLAVE_DEMO/)
    assert.equal(await Usuario.countDocuments(), 0)
  })
})
