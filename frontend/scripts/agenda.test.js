import assert from 'node:assert/strict'
import { test } from 'node:test'
import FranjaHoraria from '../src/modelo/FranjaHoraria.js'
import Sesion from '../src/modelo/Sesion.js'
import { DiaSemana, EstadoSesion } from '../src/modelo/enums.js'
import { estaOcupada, estaOcupadaEnAgenda, yaEmpezo } from '../src/servicios/agenda.js'

const DIA = '2026-12-07'
const franja = (horaInicio, horaFin, dia = DiaSemana.LUNES) => new FranjaHoraria({ dia, horaInicio, horaFin })

function reservar({ estado = EstadoSesion.PENDIENTE, fecha = DIA, horario = franja('10:00', '12:00') } = {}) {
  const sesion = new Sesion({
    franja: horario, fecha: `${fecha}T${horario.getHoraInicio()}:00-05:00`, tema: 'Repasar ciclos y arreglos',
  })
  if (estado === EstadoSesion.CONFIRMADA || estado === EstadoSesion.FINALIZADA) sesion.confirmar()
  if (estado === EstadoSesion.FINALIZADA) sesion.finalizar()
  if (estado === EstadoSesion.RECHAZADA) sesion.rechazar('No puedo atender esa fecha')
  if (estado === EstadoSesion.CANCELADA) sesion.cancelar('No puedo asistir ese día')
  return sesion
}

const solapamientos = [
  ['franja idéntica', '10:00', '12:00'],
  ['cruce por el inicio', '09:00', '11:00'],
  ['cruce por el final después de editar disponibilidad', '11:00', '13:00'],
  ['intervalo contenido', '10:30', '11:30'],
  ['intervalo envolvente', '09:00', '13:00'],
  ['cruce de un minuto al inicio', '09:00', '10:01'],
  ['cruce de un minuto al final', '11:59', '13:00'],
]

for (const estado of [EstadoSesion.PENDIENTE, EstadoSesion.CONFIRMADA]) {
  for (const [caso, inicio, fin] of solapamientos) {
    test(`${estado}: bloquea ${caso}`, () => {
      assert.equal(estaOcupada([reservar({ estado })], franja(inicio, fin), DIA), true)
    })
  }
}

for (const [caso, inicio, fin] of [['anterior', '09:00', '10:00'], ['posterior', '12:00', '13:00']]) {
  test(`una franja consecutiva ${caso} queda libre`, () => {
    assert.equal(estaOcupada([reservar({ estado: EstadoSesion.CONFIRMADA })], franja(inicio, fin), DIA), false)
  })
}

for (const estado of [EstadoSesion.RECHAZADA, EstadoSesion.CANCELADA, EstadoSesion.FINALIZADA]) {
  test(`${estado} libera incluso un intervalo solapado`, () => {
    assert.equal(estaOcupada([reservar({ estado })], franja('11:00', '13:00'), DIA), false)
  })
}

test('la misma franja en otra fecha queda libre', () => {
  assert.equal(estaOcupada([reservar()], franja('11:00', '13:00'), '2026-12-14'), false)
})

test('no confunde franjas de distintos días de la semana', () => {
  assert.equal(estaOcupada([reservar()], franja('11:00', '13:00', DiaSemana.MARTES), DIA), false)
})

test('excluir la propia sesión permite proponer un intervalo que se cruza con ella', () => {
  const sesion = reservar({ estado: EstadoSesion.CONFIRMADA })
  assert.equal(estaOcupada([sesion], franja('11:00', '13:00'), DIA, sesion.getId()), false)
})

test('excluir una sesión conserva la ocupación de otra reserva', () => {
  const propia = reservar({ estado: EstadoSesion.CONFIRMADA, horario: franja('09:00', '10:00') })
  const otra = reservar({ horario: franja('11:00', '12:00') })
  assert.equal(estaOcupada([propia, otra], franja('09:30', '11:30'), DIA, propia.getId()), true)
})

test('usa el día colombiano aunque el instante pertenezca al día siguiente en UTC', () => {
  const sesion = reservar({ horario: franja('23:00', '23:59') })
  assert.equal(sesion.getFecha().toISOString(), '2026-12-08T04:00:00.000Z')
  assert.equal(estaOcupada([sesion], franja('23:30', '23:59'), DIA), true)
  assert.equal(estaOcupada([sesion], franja('23:30', '23:59'), '2026-12-08'), false)
})

test('sin reservas el intervalo queda libre', () => {
  assert.equal(estaOcupada([], franja('10:00', '12:00'), DIA), false)
})

test('la ocupación pública detecta cruces sin reconstruir sesiones privadas', () => {
  const ocupaciones = [{ fecha: DIA, franja: { dia: 'LUNES', horaInicio: '10:00', horaFin: '12:00' } }]
  for (const [, inicio, fin] of solapamientos) assert.equal(estaOcupadaEnAgenda(ocupaciones, franja(inicio, fin), DIA), true)
  assert.equal(estaOcupadaEnAgenda(ocupaciones, franja('12:00', '13:00'), DIA), false)
  assert.equal(estaOcupadaEnAgenda(ocupaciones, franja('09:00', '10:00'), DIA), false)
  assert.equal(estaOcupadaEnAgenda(ocupaciones, franja('10:00', '12:00'), '2026-12-14'), false)
  assert.equal(estaOcupadaEnAgenda([], franja('10:00', '12:00'), DIA), false)
})

test('una tutoría se puede marcar como realizada solo desde su hora de inicio en Colombia', () => {
  const sesion = reservar({ estado: EstadoSesion.CONFIRMADA })
  assert.equal(yaEmpezo(sesion, new Date('2026-12-07T09:59:00-05:00')), false)
  assert.equal(yaEmpezo(sesion, new Date('2026-12-07T10:00:00-05:00')), true)
  assert.equal(yaEmpezo(sesion, new Date('2026-11-21T10:00:00-05:00')), false)
})
