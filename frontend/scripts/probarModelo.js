// Comprueba las reglas del dominio, la persistencia y la versión de los datos.
import { calcularMetricas, metricasACsv, ENCABEZADO_CSV } from '../src/servicios/metricas.js'
import assert from 'node:assert/strict'
import Administrador from '../src/modelo/Administrador.js'
import Calificacion from '../src/modelo/Calificacion.js'
import ErrorDeNegocio from '../src/modelo/ErrorDeNegocio.js'
import Estudiante from '../src/modelo/Estudiante.js'
import FranjaHoraria from '../src/modelo/FranjaHoraria.js'
import Materia from '../src/modelo/Materia.js'
import PerfilTutor from '../src/modelo/PerfilTutor.js'
import Programa from '../src/modelo/Programa.js'
import Sesion from '../src/modelo/Sesion.js'
import Usuario from '../src/modelo/Usuario.js'
import { DiaSemana, EstadoSesion, EstadoVerificacion, RolUsuario } from '../src/modelo/enums.js'
import ServicioAutenticacion from '../src/servicios/ServicioAutenticacion.js'
import { almacenEnMemoria, crearRepositorio, VERSION_DATOS } from '../src/servicios/repositorio.js'
import { estaOcupada, fechaEnColombia, proximasOcurrencias } from '../src/servicios/agenda.js'

const dominioPrueba = 'conectatutor.test'
const fechaPrueba = '2026-11-02T14:00:00.000Z'
const clavesRepositorio = [
  'ct.programas', 'ct.materias', 'ct.usuarios',
  'ct.perfilesTutor', 'ct.sesiones', 'ct.sesionActual', 'ct.version',
]

/**
 * Comprueba tanto el tipo de error como el código de la regla incumplida.
 * @param {string} codigo Código que debe devolver la operación.
 * @returns {function(Error): boolean} Validador para assert.throws y assert.rejects.
 */
function errorDeRegla(codigo) {
  return (error) => {
    assert.ok(error instanceof ErrorDeNegocio, 'Debe lanzar una instancia de ErrorDeNegocio.')
    assert.equal(error.getCodigo(), codigo)
    return true
  }
}

/**
 * Prepara objetos nuevos para que las pruebas de reglas no compartan mutaciones.
 * @returns {object} Participantes, oferta y disponibilidad de una tutoría válida.
 */
function crearEscenario() {
  const programa = new Programa({ nombre: 'Programa de prueba', facultad: 'Facultad de prueba' })
  const materia = new Materia({ codigo: 'PRU1', nombre: 'Materia ofrecida', programa })
  const otraMateria = new Materia({ codigo: 'PRU2', nombre: 'Materia no ofrecida', programa })
  const solicitante = new Estudiante({
    nombre: 'Solicitante de prueba', correoInstitucional: `solicitante@${dominioPrueba}`,
    semestre: 2, programa, sede: 'Sede de prueba',
  })
  const estudianteTutor = new Estudiante({
    nombre: 'Tutor de prueba', correoInstitucional: `tutor@${dominioPrueba}`,
    semestre: 6, programa, sede: 'Sede de prueba',
  })
  const administrador = new Administrador({
    nombre: 'Administrador de prueba', correoInstitucional: `admin@${dominioPrueba}`,
    dependencia: 'Dependencia de prueba',
  })
  const perfil = estudianteTutor.activarPerfilTutor('Biografía de prueba')
  const franja = new FranjaHoraria({ dia: DiaSemana.LUNES, horaInicio: '09:00', horaFin: '10:00' })
  perfil.agregarMateria(materia)
  perfil.agregarFranja(franja)
  administrador.verificarTutor(perfil)
  return { programa, materia, otraMateria, solicitante, estudianteTutor, administrador, perfil, franja }
}

/**
 * Solicita una sesión válida dentro de un escenario aislado.
 * @param {object} [escenario] Objetos de la prueba; se crean si se omiten.
 * @returns {Sesion} Sesión pendiente.
 */
function crearSesion(escenario = crearEscenario()) {
  return escenario.solicitante.solicitarSesion(
    escenario.perfil, escenario.materia, escenario.franja, fechaPrueba, 'Tema de prueba',
  )
}

/**
 * Alcanza un estado mediante las acciones públicas válidas del modelo.
 * @param {string} estado Estado requerido para la prueba.
 * @returns {Sesion} Sesión nueva en el estado solicitado.
 */
function crearSesionEnEstado(estado) {
  const sesion = crearSesion()
  if (estado === EstadoSesion.CONFIRMADA || estado === EstadoSesion.FINALIZADA) sesion.confirmar()
  if (estado === EstadoSesion.RECHAZADA) sesion.rechazar('Motivo inicial')
  if (estado === EstadoSesion.CANCELADA) sesion.cancelar('Motivo inicial')
  if (estado === EstadoSesion.FINALIZADA) sesion.finalizar()
  assert.equal(sesion.getEstado(), estado)
  return sesion
}

/**
 * Proporciona las referencias de un escenario para reconstruir objetos.
 * @param {object} escenario Objetos de la prueba.
 * @returns {object} Funciones de resolución por identificador.
 */
function crearContexto(escenario) {
  return {
    buscarPrograma: (id) => id === escenario.programa.getId() ? escenario.programa : null,
    buscarMateria: (id) => [escenario.materia, escenario.otraMateria].find((materia) => materia.getId() === id) ?? null,
    buscarEstudiante: (id) => [escenario.solicitante, escenario.estudianteTutor].find((usuario) => usuario.getId() === id) ?? null,
    buscarPerfilTutor: (id) => id === escenario.perfil.getId() ? escenario.perfil : null,
  }
}

/**
 * Crea un repositorio de prueba sin almacenamiento real ni retraso artificial.
 * @returns {Promise<object>} Almacén, repositorio y cuentas iniciales reconstruidas.
 */
async function prepararRepositorio() {
  const almacen = almacenEnMemoria()
  const repositorio = crearRepositorio(almacen, 0)
  assert.equal(await repositorio.cargarDatosIniciales(dominioPrueba), true)
  const registros = JSON.parse(almacen.getItem('ct.usuarios'))
  const usuarios = await Promise.all(registros.map((registro) => repositorio.obtenerUsuario(registro.id)))
  return { almacen, repositorio, usuarios }
}

/**
 * Registra y ejecuta cada comprobación, continuando aunque falle otra prueba.
 * @returns {Promise<void>} Finalización de todas las pruebas.
 */
async function ejecutar() {
  const iniciales = await prepararRepositorio()
  const pruebas = []

  /**
   * Agrega una prueba al recorrido de ejecución.
   * @param {string} descripcion Resultado esperado.
   * @param {function(): (void|Promise<void>)} comprobar Operación que realiza las aserciones.
   * @returns {void}
   */
  function prueba(descripcion, comprobar) {
    pruebas.push({ descripcion, comprobar })
  }

  prueba('Usuario es abstracta y rechaza new Usuario()', () => {
    assert.throws(() => new Usuario(), { message: 'Usuario es abstracta' })
  })
  prueba('El getRol base exige una implementación en la subclase', () => {
    assert.throws(() => Usuario.prototype.getRol.call({}), { message: 'Debe implementarse en la subclase' })
    const escenario = crearEscenario()
    assert.equal(escenario.solicitante.getRol(), RolUsuario.ESTUDIANTE)
    assert.equal(escenario.administrador.getRol(), RolUsuario.ADMINISTRADOR)
  })

  const enumeraciones = [
    ['RolUsuario', RolUsuario, ['ESTUDIANTE', 'ADMINISTRADOR']],
    ['EstadoSesion', EstadoSesion, ['PENDIENTE', 'CONFIRMADA', 'RECHAZADA', 'CANCELADA', 'FINALIZADA']],
    ['EstadoVerificacion', EstadoVerificacion, ['PENDIENTE', 'VERIFICADO', 'RECHAZADO']],
    ['DiaSemana', DiaSemana, ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']],
  ]
  for (const [nombre, enumeracion, valores] of enumeraciones) {
    prueba(`${nombre} tiene los valores del contrato y no permite modificaciones`, () => {
      assert.deepEqual(Object.keys(enumeracion), valores)
      assert.deepEqual(Object.values(enumeracion), valores)
      assert.ok(Object.isFrozen(enumeracion))
      assert.throws(() => { enumeracion[valores[0]] = 'MODIFICADO' }, TypeError)
      assert.throws(() => { enumeracion.EXTRA = 'EXTRA' }, TypeError)
      assert.throws(() => { delete enumeracion[valores[0]] }, TypeError)
      assert.deepEqual(Object.values(enumeracion), valores)
    })
  }

  prueba('R1 válido: un estudiante solicita tutoría a otro estudiante', () => {
    const escenario = crearEscenario()
    const sesion = crearSesion(escenario)
    assert.notEqual(sesion.getSolicitante().getId(), sesion.getTutor().getEstudiante().getId())
    assert.equal(sesion.getEstado(), EstadoSesion.PENDIENTE)
  })
  prueba('R1 inválido: un estudiante no puede solicitarse una tutoría', () => {
    const escenario = crearEscenario()
    assert.throws(() => escenario.estudianteTutor.solicitarSesion(
      escenario.perfil, escenario.materia, escenario.franja, fechaPrueba, 'Tema de prueba',
    ), errorDeRegla('R1'))
  })
  prueba('R2 válido: se puede solicitar una materia ofrecida por el tutor', () => {
    const escenario = crearEscenario()
    assert.equal(escenario.perfil.ofrece(escenario.materia), true)
    assert.strictEqual(crearSesion(escenario).getMateria(), escenario.materia)
  })
  prueba('R2 inválido: se rechaza una materia fuera de la oferta del tutor', () => {
    const escenario = crearEscenario()
    assert.throws(() => escenario.solicitante.solicitarSesion(
      escenario.perfil, escenario.otraMateria, escenario.franja, fechaPrueba, 'Tema de prueba',
    ), errorDeRegla('R2'))
  })
  prueba('R3 válido: una franja con los mismos valores está disponible', () => {
    const escenario = crearEscenario()
    const equivalente = FranjaHoraria.desdeJSON(escenario.franja.toJSON())
    assert.notStrictEqual(equivalente, escenario.franja)
    assert.equal(escenario.perfil.estaDisponible(equivalente), true)
    const sesion = escenario.solicitante.solicitarSesion(
      escenario.perfil, escenario.materia, equivalente, fechaPrueba, 'Tema de prueba',
    )
    assert.ok(sesion.getFranja().esIgualA(escenario.franja))
  })
  prueba('R3 inválido: un intervalo contenido pero distinto no está disponible', () => {
    const escenario = crearEscenario()
    const distinta = new FranjaHoraria({ dia: DiaSemana.LUNES, horaInicio: '09:15', horaFin: '09:45' })
    assert.equal(escenario.perfil.estaDisponible(distinta), false)
    assert.throws(() => escenario.solicitante.solicitarSesion(
      escenario.perfil, escenario.materia, distinta, fechaPrueba, 'Tema de prueba',
    ), errorDeRegla('R3'))
  })
  prueba('R4 válido: la administración verifica al tutor antes de la solicitud', () => {
    const escenario = crearEscenario()
    assert.equal(escenario.perfil.estaVerificado(), true)
    assert.ok(crearSesion(escenario) instanceof Sesion)
  })
  prueba('R4 inválido: se rechazan tutores pendientes y rechazados', () => {
    for (const estado of [EstadoVerificacion.PENDIENTE, EstadoVerificacion.RECHAZADO]) {
      const escenario = crearEscenario()
      const perfil = PerfilTutor.desdeJSON(
        { ...escenario.perfil.toJSON(), estadoVerificacion: estado }, crearContexto(escenario),
      )
      assert.throws(() => escenario.solicitante.solicitarSesion(
        perfil, escenario.materia, escenario.franja, fechaPrueba, 'Tema de prueba',
      ), errorDeRegla('R4'))
    }
  })

  // Tabla del contrato: cada estado se prueba contra las cuatro acciones públicas.
  const transiciones = {
    PENDIENTE: { confirmar: 'CONFIRMADA', rechazar: 'RECHAZADA', cancelar: 'CANCELADA' },
    CONFIRMADA: { finalizar: 'FINALIZADA', cancelar: 'CANCELADA' },
    RECHAZADA: {},
    CANCELADA: {},
    FINALIZADA: {},
  }
  for (const [origen, permitidas] of Object.entries(transiciones)) {
    for (const accion of ['confirmar', 'rechazar', 'cancelar', 'finalizar']) {
      const destino = permitidas[accion]
      prueba(`R5 ${destino ? 'válido' : 'inválido'}: ${origen} → ${accion}`, () => {
        const sesion = crearSesionEnEstado(origen)
        if (destino) {
          sesion[accion]('Motivo de prueba')
          assert.equal(sesion.getEstado(), destino)
          assert.equal(sesion.getMotivo(), ['rechazar', 'cancelar'].includes(accion) ? 'Motivo de prueba' : null)
        } else {
          const anterior = sesion.toJSON()
          assert.throws(() => sesion[accion]('Motivo de prueba'), errorDeRegla('R5'))
          assert.deepEqual(sesion.toJSON(), anterior)
        }
      })
    }
  }

  prueba('R6 válido: una sesión finalizada recibe una calificación', () => {
    const sesion = crearSesionEnEstado(EstadoSesion.FINALIZADA)
    const calificacion = sesion.calificar(5, 'Reseña de prueba')
    assert.ok(calificacion instanceof Calificacion)
    assert.strictEqual(sesion.getCalificacion(), calificacion)
    assert.equal(calificacion.getPuntaje(), 5)
  })
  prueba('R6 inválido: ningún estado anterior a FINALIZADA admite calificación', () => {
    for (const estado of ['PENDIENTE', 'CONFIRMADA', 'RECHAZADA', 'CANCELADA']) {
      const sesion = crearSesionEnEstado(estado)
      assert.throws(() => sesion.calificar(4, 'Reseña de prueba'), errorDeRegla('R6'))
      assert.equal(sesion.getCalificacion(), null)
    }
  })
  prueba('R6 inválido: una sesión no admite una segunda calificación', () => {
    const sesion = crearSesionEnEstado(EstadoSesion.FINALIZADA)
    const primera = sesion.calificar(4, 'Primera reseña')
    assert.throws(() => sesion.calificar(5, 'Segunda reseña'), errorDeRegla('R6'))
    assert.strictEqual(sesion.getCalificacion(), primera)
  })
  prueba('R7 válido: todos los enteros del 1 al 5 son puntajes admitidos', () => {
    for (const puntaje of [1, 2, 3, 4, 5]) {
      assert.equal(new Calificacion({ puntaje, resena: 'Reseña de prueba' }).getPuntaje(), puntaje)
    }
  })
  prueba('R7 inválido: se rechazan puntajes fuera de rango, fracciones y otros tipos', () => {
    for (const puntaje of [0, 6, -1, 2.5, '3', null, NaN, Infinity]) {
      assert.throws(() => new Calificacion({ puntaje, resena: 'Reseña de prueba' }), errorDeRegla('R7'))
    }
  })
  prueba('R8 válido: el registro y el acceso aceptan el dominio configurado', async () => {
    const { repositorio } = await prepararRepositorio()
    const [programa] = await repositorio.listarProgramas()
    const servicio = new ServicioAutenticacion(repositorio, dominioPrueba)
    const registrado = await servicio.registrar({
      nombre: 'Cuenta de prueba', correoInstitucional: `  NUEVA@${dominioPrueba.toUpperCase()}  `,
      clave: 'Demo1234', semestre: 1, programa, sede: 'Sede de prueba',
    })
    assert.ok(registrado instanceof Estudiante)
    assert.equal(registrado.getCorreo(), `nueva@${dominioPrueba}`)
    const acceso = await servicio.iniciarSesion(`NUEVA@${dominioPrueba}`, 'Demo1234')
    assert.equal(acceso.getId(), registrado.getId())
  })
  prueba('La sede del estudiante se conserva al guardar y releer', async () => {
    const { almacen, repositorio, usuarios } = await prepararRepositorio()
    const estudiante = usuarios.find((usuario) => usuario instanceof Estudiante)
    await repositorio.guardarUsuario(estudiante)
    const nuevoRepositorio = crearRepositorio(almacen, 0)
    const releido = await nuevoRepositorio.buscarUsuarioPorCorreo(estudiante.getCorreo())
    assert.ok(releido instanceof Estudiante)
    assert.equal(releido.getSede(), estudiante.getSede())
    assert.equal(releido.toJSON().sede, estudiante.getSede())
  })
  prueba('El registro rechaza con TypeError una sede fuera de la lista admitida', async () => {
    const { repositorio } = await prepararRepositorio()
    const [programa] = await repositorio.listarProgramas()
    const servicio = new ServicioAutenticacion(repositorio, dominioPrueba, ['Sede admitida'])
    await assert.rejects(() => servicio.registrar({
      nombre: 'Cuenta de sede inválida', correoInstitucional: `sede.invalida@${dominioPrueba}`,
      clave: 'Demo1234', semestre: 1, programa, sede: 'Sede fuera de la lista',
    }), { name: 'TypeError', message: 'Selecciona una sede válida.' })
  })
  prueba('R8 inválido: el registro rechaza un correo de otro dominio con código R8', async () => {
    const servicio = new ServicioAutenticacion(iniciales.repositorio, dominioPrueba)
    await assert.rejects(() => servicio.registrar({
      correoInstitucional: 'cuenta@otro.test', clave: 'Demo1234',
    }), errorDeRegla('R8'))
  })
  prueba('R8 inválido: el acceso rechaza un correo de otro dominio con código R8', async () => {
    const servicio = new ServicioAutenticacion(iniciales.repositorio, dominioPrueba)
    await assert.rejects(() => servicio.iniciarSesion('cuenta@otro.test', 'Demo1234'), errorDeRegla('R8'))
  })
  prueba('R8 inválido: subdominios, sufijos y doble arroba no cumplen el dominio exacto', async () => {
    const servicio = new ServicioAutenticacion(iniciales.repositorio, dominioPrueba)
    for (const correo of [
      `cuenta@sub.${dominioPrueba}`, `cuenta@${dominioPrueba}.otro`,
      `cuenta@@${dominioPrueba}`, `@${dominioPrueba}`, `cuenta con espacio@${dominioPrueba}`,
    ]) {
      assert.equal(servicio.validarCorreoInstitucional(correo), false)
      await assert.rejects(() => servicio.registrar({ correoInstitucional: correo }), errorDeRegla('R8'))
      await assert.rejects(() => servicio.iniciarSesion(correo, 'Demo1234'), errorDeRegla('R8'))
    }
  })
  prueba('R9 válido: franjas adyacentes del mismo día no se solapan', () => {
    const { perfil, franja } = crearEscenario()
    const adyacente = new FranjaHoraria({ dia: DiaSemana.LUNES, horaInicio: '10:00', horaFin: '11:00' })
    assert.equal(franja.seSolapaCon(adyacente), false)
    assert.equal(adyacente.seSolapaCon(franja), false)
    perfil.agregarFranja(adyacente)
    assert.equal(perfil.getDisponibilidad().length, 2)
  })
  prueba('R9 inválido: se rechazan cruces, duplicados y franjas contenidas', () => {
    for (const [horaInicio, horaFin] of [['09:30', '10:30'], ['09:00', '10:00'], ['09:15', '09:45']]) {
      const { perfil } = crearEscenario()
      const solapada = new FranjaHoraria({ dia: DiaSemana.LUNES, horaInicio, horaFin })
      assert.throws(() => perfil.agregarFranja(solapada), errorDeRegla('R9'))
      assert.equal(perfil.getDisponibilidad().length, 1)
    }
  })
  prueba('R9 válido: las mismas horas en días distintos son independientes', () => {
    const { perfil, franja } = crearEscenario()
    const otroDia = new FranjaHoraria({ dia: DiaSemana.MARTES, horaInicio: '09:00', horaFin: '10:00' })
    assert.equal(franja.seSolapaCon(otroDia), false)
    perfil.agregarFranja(otroDia)
    assert.equal(perfil.getDisponibilidad().length, 2)
  })
  prueba('R10 válido: un perfil nuevo representa la tutoría gratuita con null', () => {
    const { perfil } = crearEscenario()
    assert.equal(perfil.getTarifaHora(), null)
    assert.equal(perfil.toJSON().tarifaHora, null)
  })
  prueba('R10 válido: reconstruir una tutoría gratuita conserva tarifa null', () => {
    const escenario = crearEscenario()
    const reconstruido = PerfilTutor.desdeJSON(escenario.perfil.toJSON(), crearContexto(escenario))
    assert.ok(reconstruido instanceof PerfilTutor)
    assert.equal(reconstruido.getTarifaHora(), null)
    assert.strictEqual(reconstruido.getEstudiante().getPerfilTutor(), reconstruido)
  })
  prueba('R10 válido: una tarifa numérica positiva puede reconstruirse', () => {
    const escenario = crearEscenario()
    const reconstruido = PerfilTutor.desdeJSON(
      { ...escenario.perfil.toJSON(), tarifaHora: 15000 }, crearContexto(escenario),
    )
    assert.equal(reconstruido.getTarifaHora(), 15000)
  })
  prueba('R10 inválido: cero, negativos y valores no numéricos o no finitos lanzan R10', () => {
    for (const tarifaHora of [0, -1, '15000', NaN, Infinity, -Infinity]) {
      const escenario = crearEscenario()
      assert.throws(() => PerfilTutor.desdeJSON(
        { ...escenario.perfil.toJSON(), tarifaHora }, crearContexto(escenario),
      ), errorDeRegla('R10'))
    }
  })

  prueba('Los datos iniciales tienen 4 programas, 32 materias, 6 estudiantes, 1 administrador y 5 sesiones', async () => {
    const { almacen, repositorio, usuarios } = iniciales
    assert.equal((await repositorio.listarProgramas()).length, 4)
    assert.equal((await repositorio.listarMaterias()).length, 32)
    assert.equal(usuarios.filter((usuario) => usuario instanceof Estudiante).length, 6)
    assert.equal(usuarios.filter((usuario) => usuario instanceof Administrador).length, 1)
    assert.equal((await repositorio.listarTutoresVerificados()).length, 3)
    assert.equal((await repositorio.listarPerfilesPendientes()).length, 1)
    assert.equal(JSON.parse(almacen.getItem('ct.perfilesTutor')).length, 4)
    const sesiones = JSON.parse(almacen.getItem('ct.sesiones'))
    assert.equal(sesiones.length, 5)
    assert.equal(new Set(sesiones.map((sesion) => sesion.estado)).size, 4)
    assert.equal(sesiones.filter((sesion) => sesion.estado === EstadoSesion.FINALIZADA && sesion.calificacion !== null).length, 1)
    assert.ok(usuarios.every((usuario) => usuario.getCorreo().endsWith(`@${dominioPrueba}`)))
  })
  prueba('Los filtros por sede y día cumplen las condiciones y los filtros vacíos no limitan', async () => {
    const { repositorio } = iniciales
    const todos = await repositorio.listarTutoresVerificados()
    const sede = todos[0].getEstudiante().getSede()
    const porSede = await repositorio.listarTutoresVerificados({ sede })
    assert.deepEqual(porSede.map((perfil) => perfil.getId()), todos.filter((perfil) => perfil.getEstudiante().getSede() === sede).map((perfil) => perfil.getId()))
    for (const dia of Object.values(DiaSemana)) {
      const resultado = await repositorio.listarTutoresVerificados({ dia })
      assert.deepEqual(resultado.map((perfil) => perfil.getId()), todos.filter((perfil) => perfil.getDisponibilidad().some((franja) => franja.getDia() === dia)).map((perfil) => perfil.getId()))
    }
    for (const vacio of ['', null, undefined]) {
      assert.deepEqual((await repositorio.listarTutoresVerificados({ sede: vacio, dia: vacio, materiaId: vacio, programaId: vacio })).map((perfil) => perfil.getId()), todos.map((perfil) => perfil.getId()))
    }
  })
  prueba('listarSesionesDelTutor devuelve solo las sesiones del perfil indicado', async () => {
    const { repositorio, almacen } = iniciales
    for (const perfil of await repositorio.listarTutoresVerificados()) {
      const sesiones = await repositorio.listarSesionesDelTutor(perfil.getId())
      assert.ok(sesiones.every((sesion) => sesion.getTutor().getId() === perfil.getId()))
      assert.equal(sesiones.length, JSON.parse(almacen.getItem('ct.sesiones')).filter((sesion) => sesion.perfilTutorId === perfil.getId()).length)
    }
    assert.deepEqual(await repositorio.listarSesionesDelTutor('inexistente'), [])
  })
  prueba('La agenda encuentra los próximos lunes a las 09:00 en Colombia', () => {
    const franja = new FranjaHoraria({ dia: DiaSemana.LUNES, horaInicio: '09:00', horaFin: '10:00' })
    const resultado = proximasOcurrencias(franja, new Date('2026-10-29T12:00:00-05:00'))
    assert.deepEqual(resultado.map(({ clave }) => clave), ['2026-11-02', '2026-11-09'])
    assert.equal(resultado[0].fecha.toISOString(), '2026-11-02T14:00:00.000Z')
  })
  prueba('Las siete cuentas iniciales acceden con Demo1234 y hashes SHA-256', async () => {
    const servicio = new ServicioAutenticacion(iniciales.repositorio, dominioPrueba)
    assert.equal(iniciales.usuarios.length, 7)
    for (const usuario of iniciales.usuarios) {
      const acceso = await servicio.iniciarSesion(usuario.getCorreo(), 'Demo1234')
      assert.equal(acceso.getId(), usuario.getId())
      assert.ok(acceso instanceof Usuario)
      assert.match(iniciales.repositorio.obtenerClaveHash(usuario.getId()), /^[a-f0-9]{64}$/)
      assert.equal(Object.hasOwn(acceso.toJSON(), 'claveHash'), false)
    }
  })
  prueba('Guardar y releer una sesión conserva clases, identificadores, fechas y referencias compartidas', async () => {
    const { almacen, repositorio, usuarios } = await prepararRepositorio()
    const [perfil] = await repositorio.listarTutoresVerificados()
    const solicitante = usuarios.find((usuario) => usuario instanceof Estudiante && usuario.getId() !== perfil.getEstudiante().getId())
    const [materia] = perfil.getMaterias()
    const [franja] = perfil.getDisponibilidad()
    const sesion = solicitante.solicitarSesion(perfil, materia, franja, fechaPrueba, 'Persistencia de prueba')
    sesion.confirmar()
    sesion.finalizar()
    sesion.calificar(5, 'Calificación persistida')
    assert.ok(await repositorio.guardarSesion(sesion) instanceof Sesion)
    const nuevoRepositorio = crearRepositorio(almacen, 0)
    const releidas = await nuevoRepositorio.listarSesionesDe(solicitante.getId())
    const releida = releidas.find((guardada) => guardada.getId() === sesion.getId())
    assert.ok(releida instanceof Sesion)
    assert.notStrictEqual(releida, sesion)
    assert.ok(releida.getCalificacion() instanceof Calificacion)
    assert.ok(releida.getFranja() instanceof FranjaHoraria)
    assert.ok(releida.getFecha() instanceof Date)
    assert.ok(releida.getCalificacion().getFecha() instanceof Date)
    assert.deepEqual(releida.toJSON(), sesion.toJSON())
    assert.strictEqual(releida.getTutor().getEstudiante().getPerfilTutor(), releida.getTutor())
    assert.strictEqual(releida.getMateria(), releida.getTutor().getMaterias().find((ofrecida) => ofrecida.getId() === materia.getId()))
    const delTutor = await nuevoRepositorio.listarSesionesDe(perfil.getEstudiante().getId())
    assert.ok(delTutor.some((guardada) => guardada.getId() === sesion.getId()))
  })
  prueba('Guardar un usuario sin claveHash conserva sus credenciales anteriores', async () => {
    const { repositorio, usuarios } = await prepararRepositorio()
    const usuario = usuarios[0]
    const anterior = repositorio.obtenerClaveHash(usuario.getId())
    const guardado = await repositorio.guardarUsuario(usuario)
    assert.ok(guardado instanceof Usuario)
    assert.equal(repositorio.obtenerClaveHash(usuario.getId()), anterior)
    const servicio = new ServicioAutenticacion(repositorio, dominioPrueba)
    assert.equal((await servicio.iniciarSesion(usuario.getCorreo(), 'Demo1234')).getId(), usuario.getId())
  })
  prueba('Una segunda carga inicial conserva todos los registros existentes', async () => {
    const { almacen, repositorio } = await prepararRepositorio()
    const anteriores = clavesRepositorio.map((clave) => almacen.getItem(clave))
    assert.equal(await repositorio.cargarDatosIniciales('otro-dominio.test'), false)
    assert.deepEqual(clavesRepositorio.map((clave) => almacen.getItem(clave)), anteriores)
  })
  prueba('La carga inicial tampoco sobrescribe un repositorio parcialmente poblado', async () => {
    const almacen = almacenEnMemoria()
    const { programa } = crearEscenario()
    const registro = JSON.stringify([programa.toJSON()])
    almacen.setItem('ct.programas', registro)
    const repositorio = crearRepositorio(almacen, 0)
    assert.equal(await repositorio.cargarDatosIniciales(dominioPrueba), false)
    assert.equal(almacen.getItem('ct.programas'), registro)
    assert.equal(almacen.getItem('ct.usuarios'), null)
    assert.equal((await repositorio.listarProgramas()).length, 1)
  })
  prueba('Reiniciar elimina solo las siete claves propias del repositorio', async () => {
    const { almacen, repositorio, usuarios } = await prepararRepositorio()
    almacen.setItem('otra.aplicacion', 'conservar')
    repositorio.guardarSesionActual(usuarios[0].getId())
    await repositorio.reiniciar()
    assert.ok(clavesRepositorio.every((clave) => almacen.getItem(clave) === null))
    assert.equal(almacen.getItem('otra.aplicacion'), 'conservar')
    assert.deepEqual(await repositorio.listarProgramas(), [])
    assert.equal(await repositorio.obtenerSesionActual(), null)
  })
  prueba('El acceso restaura una instancia de usuario y cerrarSesion elimina la sesión actual', async () => {
    const { repositorio, usuarios } = await prepararRepositorio()
    const servicio = new ServicioAutenticacion(repositorio, dominioPrueba)
    const usuario = usuarios[0]
    assert.equal(await repositorio.obtenerSesionActual(), null)
    await servicio.iniciarSesion(usuario.getCorreo(), 'Demo1234')
    const actual = await repositorio.obtenerSesionActual()
    assert.ok(actual instanceof Usuario)
    assert.equal(actual.getId(), usuario.getId())
    servicio.cerrarSesion()
    assert.equal(await repositorio.obtenerSesionActual(), null)
  })
  prueba('Las franjas rechazan formatos inválidos e intervalos sin duración positiva', () => {
    for (const [horaInicio, horaFin] of [['9:00', '10:00'], ['24:00', '25:00'], ['09:60', '10:00']]) {
      assert.throws(() => new FranjaHoraria({ dia: DiaSemana.LUNES, horaInicio, horaFin }), TypeError)
    }
    for (const [horaInicio, horaFin] of [['10:00', '09:00'], ['09:00', '09:00']]) {
      assert.throws(() => new FranjaHoraria({ dia: DiaSemana.LUNES, horaInicio, horaFin }), RangeError)
    }
  })
  prueba('El promedio del tutor usa solo sus calificaciones y redondea a un decimal', () => {
    const escenario = crearEscenario()
    assert.equal(escenario.perfil.calcularPromedio([]), 0)
    const propias = [4, 4, 5].map((puntaje) => {
      const sesion = crearSesion(escenario)
      sesion.confirmar()
      sesion.finalizar()
      sesion.calificar(puntaje, 'Reseña de prueba')
      return sesion
    })
    const ajena = crearSesionEnEstado(EstadoSesion.FINALIZADA)
    ajena.calificar(1, 'Otro tutor')
    assert.equal(escenario.perfil.calcularPromedio([...propias, crearSesion(escenario), ajena]), 4.3)
  })

  prueba('M1: un perfil con estudiante inexistente se rechaza sin alterar el repositorio', async () => {
    const { almacen, repositorio } = await prepararRepositorio()
    const { perfil, estudianteTutor } = crearEscenario()
    const anteriores = clavesRepositorio.map((clave) => almacen.getItem(clave))
    await assert.rejects(() => repositorio.guardarPerfilTutor(perfil), (error) => {
      assert.equal(error.constructor, Error)
      assert.equal(error.message, `Referencia inexistente: Estudiante ${estudianteTutor.getId()}`)
      return true
    })
    assert.deepEqual(clavesRepositorio.map((clave) => almacen.getItem(clave)), anteriores)
    assert.equal((await repositorio.listarProgramas()).length, 4)
  })
  prueba('M1: una sesión con perfil inexistente se rechaza y las sesiones guardadas siguen legibles', async () => {
    const { almacen, repositorio, usuarios } = await prepararRepositorio()
    const { perfil, franja } = crearEscenario()
    const solicitante = usuarios.find((usuario) => usuario instanceof Estudiante)
    const [materia] = await repositorio.listarMaterias()
    perfil.agregarMateria(materia)
    const sesion = solicitante.solicitarSesion(perfil, materia, franja, fechaPrueba, 'Tema de prueba')
    const sesionesAnteriores = (await repositorio.listarSesionesDe(solicitante.getId())).map((guardada) => guardada.toJSON())
    const anteriores = clavesRepositorio.map((clave) => almacen.getItem(clave))
    await assert.rejects(() => repositorio.guardarSesion(sesion), (error) => {
      assert.equal(error.constructor, Error)
      assert.equal(error.message, `Referencia inexistente: PerfilTutor ${perfil.getId()}`)
      return true
    })
    assert.deepEqual(clavesRepositorio.map((clave) => almacen.getItem(clave)), anteriores)
    const sesionesActuales = await repositorio.listarSesionesDe(solicitante.getId())
    assert.deepEqual(sesionesActuales.map((guardada) => guardada.toJSON()), sesionesAnteriores)
  })
  prueba('m1: reconstruir un perfil con estado de verificación inválido lanza TypeError en español', () => {
    const escenario = crearEscenario()
    assert.throws(() => PerfilTutor.desdeJSON(
      { ...escenario.perfil.toJSON(), estadoVerificacion: 'CUALQUIERA' }, crearContexto(escenario),
    ), { name: 'TypeError', message: 'El estado de verificación del perfil no es válido.' })
  })
  prueba('m2: construir una sesión con fecha inválida lanza TypeError en español', () => {
    const { solicitante, perfil, materia, franja } = crearEscenario()
    assert.throws(() => new Sesion({
      solicitante, tutor: perfil, materia, franja, fecha: 'no-es-fecha', tema: 'Tema de prueba',
    }), { name: 'TypeError', message: 'La fecha de la sesión no es válida.' })
  })

  prueba('B7: quitarFranja retira solo la igual y permite agregarla otra vez', () => {
    const { perfil, franja } = crearEscenario()
    const otra = new FranjaHoraria({ dia: DiaSemana.MARTES, horaInicio: '09:00', horaFin: '10:00' })
    perfil.agregarFranja(otra)
    perfil.quitarFranja(FranjaHoraria.desdeJSON(franja.toJSON()))
    assert.deepEqual(perfil.getDisponibilidad(), [otra])
    perfil.quitarFranja(franja)
    perfil.agregarFranja(franja)
    assert.equal(perfil.getDisponibilidad().length, 2)
  })
  prueba('B7: el motivo de rechazo persiste y verificarlo lo borra', async () => {
    const { repositorio } = await prepararRepositorio()
    const [perfil] = await repositorio.listarTutoresVerificados()
    perfil.marcarRechazado('  Completa tu presentación  ')
    assert.equal(perfil.getMotivoRechazo(), 'Completa tu presentación')
    await repositorio.guardarPerfilTutor(perfil)
    const guardado = await repositorio.obtenerPerfilTutor(perfil.getId())
    assert.equal(guardado.getMotivoRechazo(), 'Completa tu presentación')
    guardado.marcarVerificado()
    assert.equal(guardado.getMotivoRechazo(), null)
  })
  prueba('B7: un motivo inválido no cambia el estado del perfil', () => {
    const { perfil } = crearEscenario()
    for (const motivo of ['', '  ab ']) assert.throws(() => perfil.marcarRechazado(motivo), TypeError)
    assert.equal(perfil.getEstadoVerificacion(), EstadoVerificacion.VERIFICADO)
    assert.equal(perfil.getMotivoRechazo(), null)
  })
  prueba('B7: nueva revisión solo desde rechazado y sin conservar el motivo', () => {
    const { perfil } = crearEscenario()
    assert.throws(() => perfil.solicitarNuevaRevision(), Error)
    perfil.marcarRechazado('Completa tu perfil')
    perfil.solicitarNuevaRevision()
    assert.equal(perfil.getEstadoVerificacion(), EstadoVerificacion.PENDIENTE)
    assert.equal(perfil.getMotivoRechazo(), null)
    assert.throws(() => perfil.solicitarNuevaRevision(), Error)
  })
  prueba('B7: cambiarBiografia valida longitud y quita espacios exteriores', () => {
    const { perfil } = crearEscenario()
    assert.throws(() => perfil.cambiarBiografia('  Muy corta  '), TypeError)
    perfil.cambiarBiografia('  Acompaño a estudiantes con ejercicios prácticos.  ')
    assert.equal(perfil.getBiografia(), 'Acompaño a estudiantes con ejercicios prácticos.')
  })

  prueba('B7: listarSesiones y listarPerfilesTutor incluyen todos los estados', async () => {
    const { repositorio } = await prepararRepositorio()
    assert.equal((await repositorio.listarSesiones()).length, 5)
    assert.equal((await repositorio.listarPerfilesTutor()).length, 4)
  })
  prueba('B7: estaOcupada distingue estado, día y sesión excluida', () => {
    const sesion = crearSesion()
    const clave = fechaEnColombia(sesion.getFecha())
    assert.equal(estaOcupada([sesion], sesion.getFranja(), clave), true)
    assert.equal(estaOcupada([sesion], sesion.getFranja(), '2026-11-03'), false)
    assert.equal(estaOcupada([sesion], sesion.getFranja(), clave, sesion.getId()), false)
    sesion.confirmar()
    assert.equal(estaOcupada([sesion], sesion.getFranja(), clave), true)
    sesion.cancelar('Ya no puedo asistir')
    assert.equal(estaOcupada([sesion], sesion.getFranja(), clave), false)
  })
  prueba('B7: métricas iniciales y estudiantes únicos por sede y total', async () => {
    const { repositorio } = await prepararRepositorio()
    const sesiones = await repositorio.listarSesiones()
    const perfiles = await repositorio.listarPerfilesTutor()
    const sedes = ['Riohacha', 'Maicao', 'Villanueva', 'Fonseca']
    const metricas = calcularMetricas(sesiones, perfiles, sedes)
    assert.deepEqual([metricas.total.solicitudes, metricas.total.finalizadas, metricas.total.estudiantesAtendidos,
      metricas.total.tutoresVerificados, metricas.total.tutoresPendientes], [5, 2, 2, 3, 1])
    assert.equal(calcularMetricas(sesiones, perfiles, [...sedes, 'Sin actividad']).porSede['Sin actividad'].solicitudes, 0)
    const finalizada = sesiones.find((sesion) => sesion.getEstado() === EstadoSesion.FINALIZADA)
    assert.equal(calcularMetricas([...sesiones, finalizada], perfiles, sedes).total.estudiantesAtendidos, 2)
    const sinSedes = calcularMetricas(sesiones, perfiles, [])
    assert.deepEqual(sinSedes.total, metricas.total)
    assert.deepEqual(sinSedes.porSede, {})
  })
  prueba('B7: CSV con BOM, encabezado exacto, cuatro sedes y total, y coma decimal', async () => {
    const { repositorio } = await prepararRepositorio()
    const sedes = ['Riohacha', 'Maicao', 'Villanueva', 'Fonseca']
    const metricas = calcularMetricas(await repositorio.listarSesiones(), await repositorio.listarPerfilesTutor(), sedes)
    metricas.total.calificacionPromedio = 4.5
    const csv = metricasACsv(metricas, sedes)
    assert.ok(csv.startsWith('\uFEFF' + ENCABEZADO_CSV + '\r\n'))
    assert.equal(ENCABEZADO_CSV, 'Sede;Solicitudes;Pendientes;Confirmadas;Finalizadas;Rechazadas;Canceladas;Estudiantes atendidos;Tutores verificados;Tutores pendientes;Calificación promedio')
    const lineas = csv.slice(1).split('\r\n')
    assert.equal(lineas.length, 6)
    assert.deepEqual(lineas.slice(1, 5).map((linea) => linea.split(';')[0]), sedes)
    assert.ok(lineas[5].startsWith('Total;'))
    assert.ok(lineas[5].endsWith(';4,5'))
  })

  prueba('B8: datos sin versión se reinician y vuelven a cargar cinco sesiones', async () => {
    const { almacen, repositorio } = await prepararRepositorio()
    assert.equal(almacen.getItem('ct.version'), null)
    assert.equal(await repositorio.asegurarVersion(), true)
    for (const clave of clavesRepositorio.filter((clave) => clave !== 'ct.version')) assert.equal(almacen.getItem(clave), null)
    assert.equal(almacen.getItem('ct.version'), String(VERSION_DATOS))
    assert.equal(await repositorio.cargarDatosIniciales(), true)
    assert.equal((await repositorio.listarSesiones()).length, 5)
  })
  prueba('B8: la versión correcta conserva todas las colecciones', async () => {
    const { almacen, repositorio } = await prepararRepositorio()
    almacen.setItem('ct.version', String(VERSION_DATOS))
    const anteriores = clavesRepositorio.map((clave) => almacen.getItem(clave))
    assert.equal(await repositorio.asegurarVersion(), false)
    assert.deepEqual(clavesRepositorio.map((clave) => almacen.getItem(clave)), anteriores)
    assert.equal((await repositorio.listarSesiones()).length, 5)
  })

  let correctas = 0
  for (const { descripcion, comprobar } of pruebas) {
    try {
      await comprobar()
      correctas += 1
      process.stdout.write(`✔ ${descripcion}\n`)
    } catch (error) {
      process.stderr.write(`✘ ${descripcion}: ${String(error?.message ?? error).replace(/\s+/g, ' ')}\n`)
    }
  }

  const fallidas = pruebas.length - correctas
  process.stdout.write(`Total: ${pruebas.length} pruebas; ${correctas} correctas; ${fallidas} fallidas.\n`)
  if (fallidas > 0) process.exitCode = 1
}

ejecutar().catch((error) => {
  process.stderr.write(`✘ Preparación global: ${String(error?.message ?? error).replace(/\s+/g, ' ')}\n`)
  process.stdout.write('Total: preparación fallida; no se pudieron ejecutar todas las pruebas.\n')
  process.exitCode = 1
})
