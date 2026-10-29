import { EstadoSesion } from './enums.js'
import ErrorDeNegocio from './ErrorDeNegocio.js'
import FranjaHoraria from './FranjaHoraria.js'
import Calificacion from './Calificacion.js'

/** Sesión de tutoría que controla sus transiciones de estado y su calificación. */
export default class Sesion {
  #id
  #solicitante
  #tutor
  #materia
  #franja
  #fecha
  #tema
  #estado
  #motivo
  #calificacion

  /**
   * Crea una sesión pendiente con fecha y referencias del dominio.
   * @param {object} datos Datos de la solicitud.
   * @param {import('./Estudiante.js').default} datos.solicitante Estudiante que solicita la sesión.
   * @param {import('./PerfilTutor.js').default} datos.tutor Perfil del tutor solicitado.
   * @param {import('./Materia.js').default} datos.materia Materia de la sesión.
   * @param {FranjaHoraria} datos.franja Franja solicitada.
   * @param {Date|string} datos.fecha Fecha de la sesión.
   * @param {string} datos.tema Tema solicitado.
   * @throws {TypeError} Si la fecha de la sesión no es válida.
   */
  constructor({ solicitante, tutor, materia, franja, fecha, tema }) {
    this.#id = crypto.randomUUID()
    this.#solicitante = solicitante
    this.#tutor = tutor
    this.#materia = materia
    this.#franja = franja
    this.#fecha = new Date(fecha)

    if (Number.isNaN(this.#fecha.getTime())) {
      throw new TypeError('La fecha de la sesión no es válida.')
    }

    this.#tema = tema
    this.#estado = EstadoSesion.PENDIENTE
    this.#motivo = null
    this.#calificacion = null
  }

  /**
   * Consulta el identificador de la sesión.
   * @returns {string} Identificador único.
   */
  getId() {
    return this.#id
  }

  /**
   * Consulta el estudiante que solicitó la sesión.
   * @returns {import('./Estudiante.js').default} Solicitante de la tutoría.
   */
  getSolicitante() {
    return this.#solicitante
  }

  /**
   * Consulta el perfil del tutor solicitado.
   * @returns {import('./PerfilTutor.js').default} Perfil del tutor.
   */
  getTutor() {
    return this.#tutor
  }

  /**
   * Consulta la materia de la sesión.
   * @returns {import('./Materia.js').default} Materia solicitada.
   */
  getMateria() {
    return this.#materia
  }

  /**
   * Consulta la franja de la sesión.
   * @returns {FranjaHoraria} Franja solicitada.
   */
  getFranja() {
    return this.#franja
  }

  /**
   * Consulta una copia de la fecha sin exponer el objeto interno.
   * @returns {Date} Fecha de la sesión.
   */
  getFecha() {
    return new Date(this.#fecha)
  }

  /**
   * Consulta el tema de la sesión.
   * @returns {string} Tema solicitado.
   */
  getTema() {
    return this.#tema
  }

  /**
   * Consulta el estado actual de la sesión.
   * @returns {string} Valor de EstadoSesion.
   */
  getEstado() {
    return this.#estado
  }

  /**
   * Consulta el motivo de rechazo o cancelación.
   * @returns {string|null} Motivo registrado, o null si no corresponde.
   */
  getMotivo() {
    return this.#motivo
  }

  /**
   * Consulta la calificación de la sesión.
   * @returns {Calificacion|null} Calificación registrada, o null si todavía no existe.
   */
  getCalificacion() {
    return this.#calificacion
  }

  /**
   * Confirma una sesión pendiente.
   * @returns {void}
   * @throws {ErrorDeNegocio} Con código R5 si la sesión no está pendiente.
   */
  confirmar() {
    this.#cambiarEstado([EstadoSesion.PENDIENTE], EstadoSesion.CONFIRMADA)
  }

  /**
   * Rechaza una sesión pendiente y registra el motivo.
   * @param {string} motivo Explicación del rechazo.
   * @returns {void}
   * @throws {ErrorDeNegocio} Con código R5 si la sesión no está pendiente.
   */
  rechazar(motivo) {
    this.#cambiarEstado([EstadoSesion.PENDIENTE], EstadoSesion.RECHAZADA, motivo)
  }

  /**
   * Cancela una sesión pendiente o confirmada y registra el motivo.
   * @param {string} motivo Explicación de la cancelación.
   * @returns {void}
   * @throws {ErrorDeNegocio} Con código R5 si la sesión no está pendiente ni confirmada.
   */
  cancelar(motivo) {
    this.#cambiarEstado(
      [EstadoSesion.PENDIENTE, EstadoSesion.CONFIRMADA],
      EstadoSesion.CANCELADA,
      motivo,
    )
  }

  /**
   * Finaliza una sesión confirmada.
   * @returns {void}
   * @throws {ErrorDeNegocio} Con código R5 si la sesión no está confirmada.
   */
  finalizar() {
    this.#cambiarEstado([EstadoSesion.CONFIRMADA], EstadoSesion.FINALIZADA)
  }

  /**
   * Califica una sesión finalizada una sola vez.
   * @param {number} puntaje Entero de 1 a 5.
   * @param {string} resena Reseña del estudiante.
   * @returns {Calificacion} Calificación registrada en la sesión.
   * @throws {ErrorDeNegocio} Con código R6 si no está finalizada o ya fue calificada, o R7 si el puntaje es inválido.
   */
  calificar(puntaje, resena) {
    if (this.#estado !== EstadoSesion.FINALIZADA || this.#calificacion !== null) {
      throw new ErrorDeNegocio('R6', 'Solo puedes calificar una sesión finalizada y una sola vez.')
    }

    this.#calificacion = new Calificacion({ puntaje, resena })
    return this.#calificacion
  }

  /**
   * Aplica un cambio únicamente desde los estados permitidos por R5.
   * @param {string[]} estadosPermitidos Estados de origen válidos.
   * @param {string} nuevoEstado Estado de destino.
   * @param {string|null} [motivo=null] Motivo del cambio, si corresponde.
   * @returns {void}
   * @throws {ErrorDeNegocio} Con código R5 si la transición no está permitida.
   */
  #cambiarEstado(estadosPermitidos, nuevoEstado, motivo = null) {
    if (!estadosPermitidos.includes(this.#estado)) {
      throw new ErrorDeNegocio('R5', 'El estado actual de la sesión no permite realizar esta acción.')
    }

    this.#estado = nuevoEstado
    this.#motivo = motivo
  }

  /**
   * Serializa las referencias por identificador y embebe sus objetos de valor.
   * @returns {object} Datos persistibles de la sesión con fecha ISO.
   */
  toJSON() {
    return {
      id: this.#id,
      solicitanteId: this.#solicitante.getId(),
      perfilTutorId: this.#tutor.getId(),
      materiaId: this.#materia.getId(),
      franja: this.#franja.toJSON(),
      fecha: this.#fecha.toISOString(),
      tema: this.#tema,
      estado: this.#estado,
      motivo: this.#motivo,
      calificacion: this.#calificacion?.toJSON() ?? null,
    }
  }

  /**
   * Reconstruye una sesión conservando su estado, identificador y objetos de valor.
   * @param {object} datos Datos persistidos de la sesión.
   * @param {object} contexto Funciones para resolver las referencias guardadas.
   * @param {function(string): import('./Estudiante.js').default} contexto.buscarEstudiante Resuelve el solicitante.
   * @param {function(string): import('./PerfilTutor.js').default} contexto.buscarPerfilTutor Resuelve el tutor.
   * @param {function(string): import('./Materia.js').default} contexto.buscarMateria Resuelve la materia.
   * @returns {Sesion} Sesión reconstruida con instancias del dominio.
   * @throws {ErrorDeNegocio} Con código R5 si el estado es inválido, R6 si una calificación no corresponde a una sesión finalizada, o R7 si el puntaje es inválido.
   * @throws {TypeError} Si la fecha de la sesión o la franja persistida no son válidas.
   * @throws {RangeError} Si la franja persistida no tiene duración positiva.
   */
  static desdeJSON(datos, contexto) {
    if (!Object.values(EstadoSesion).includes(datos.estado)) {
      throw new ErrorDeNegocio('R5', 'El estado guardado de la sesión no es válido.')
    }

    if (datos.calificacion != null && datos.estado !== EstadoSesion.FINALIZADA) {
      throw new ErrorDeNegocio('R6', 'Solo una sesión finalizada puede tener calificación.')
    }

    const sesion = new Sesion({
      solicitante: contexto.buscarEstudiante(datos.solicitanteId),
      tutor: contexto.buscarPerfilTutor(datos.perfilTutorId),
      materia: contexto.buscarMateria(datos.materiaId),
      franja: FranjaHoraria.desdeJSON(datos.franja, contexto),
      fecha: datos.fecha,
      tema: datos.tema,
    })
    sesion.#id = datos.id
    sesion.#estado = datos.estado
    sesion.#motivo = datos.motivo ?? null
    sesion.#calificacion = datos.calificacion == null
      ? null
      : Calificacion.desdeJSON(datos.calificacion, contexto)
    return sesion
  }
}
