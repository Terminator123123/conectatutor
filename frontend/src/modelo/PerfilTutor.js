import { EstadoVerificacion } from './enums.js'
import ErrorDeNegocio from './ErrorDeNegocio.js'
import FranjaHoraria from './FranjaHoraria.js'

/** Perfil de tutor que pertenece a un estudiante y administra su oferta y disponibilidad. */
export default class PerfilTutor {
  #id
  #estudiante
  #biografia
  #tarifaHora
  #estadoVerificacion
  #materias
  #disponibilidad

  /**
   * Crea el perfil desde la activación realizada por su estudiante.
   * @param {object} datos Datos iniciales del perfil.
   * @param {import('./Estudiante.js').default} datos.estudiante Estudiante dueño del perfil.
   * @param {string} datos.biografia Presentación del tutor.
   */
  constructor({ estudiante, biografia }) {
    this.#id = crypto.randomUUID()
    this.#estudiante = estudiante
    this.#biografia = biografia
    this.#tarifaHora = null
    this.#estadoVerificacion = EstadoVerificacion.PENDIENTE
    this.#materias = []
    this.#disponibilidad = []
  }

  /**
   * Consulta el identificador del perfil.
   * @returns {string} Identificador único.
   */
  getId() {
    return this.#id
  }

  /**
   * Consulta el estudiante dueño del perfil.
   * @returns {import('./Estudiante.js').default} Estudiante asociado.
   */
  getEstudiante() {
    return this.#estudiante
  }

  /**
   * Consulta la presentación del tutor.
   * @returns {string} Biografía del tutor.
   */
  getBiografia() {
    return this.#biografia
  }

  /**
   * Consulta la tarifa por hora; null representa una tutoría gratuita.
   * @returns {number|null} Tarifa del perfil.
   */
  getTarifaHora() {
    return this.#tarifaHora
  }

  /**
   * Consulta el estado de verificación del tutor.
   * @returns {string} Valor de EstadoVerificacion.
   */
  getEstadoVerificacion() {
    return this.#estadoVerificacion
  }

  /**
   * Consulta las materias sin exponer el arreglo interno.
   * @returns {import('./Materia.js').default[]} Copia de las materias ofrecidas.
   */
  getMaterias() {
    return [...this.#materias]
  }

  /**
   * Consulta la disponibilidad sin exponer el arreglo interno.
   * @returns {FranjaHoraria[]} Copia de las franjas disponibles.
   */
  getDisponibilidad() {
    return [...this.#disponibilidad]
  }

  /**
   * Comprueba por identificador si el tutor ofrece una materia.
   * @param {import('./Materia.js').default} materia Materia consultada.
   * @returns {boolean} Verdadero si la materia está en la oferta.
   */
  ofrece(materia) {
    return this.#materias.some((ofrecida) => ofrecida.getId() === materia.getId())
  }

  /**
   * Incorpora una materia a la oferta sin duplicarla.
   * @param {import('./Materia.js').default} materia Materia que se agrega.
   * @returns {void}
   */
  agregarMateria(materia) {
    if (!this.ofrece(materia)) {
      this.#materias.push(materia)
    }
  }

  /**
   * Retira de la oferta la materia con el identificador indicado.
   * @param {import('./Materia.js').default} materia Materia que se retira.
   * @returns {void}
   */
  quitarMateria(materia) {
    this.#materias = this.#materias.filter((ofrecida) => ofrecida.getId() !== materia.getId())
  }

  /**
   * Agrega disponibilidad respetando la prohibición de solapamientos R9.
   * @param {FranjaHoraria} franja Franja que se agrega.
   * @returns {void}
   * @throws {ErrorDeNegocio} Con código R9 si la franja se solapa con una existente.
   */
  agregarFranja(franja) {
    if (this.#disponibilidad.some((existente) => existente.seSolapaCon(franja))) {
      throw new ErrorDeNegocio('R9', 'La franja horaria se solapa con otra de tu disponibilidad.')
    }

    this.#disponibilidad.push(franja)
  }

  /**
   * Comprueba si la franja solicitada coincide con una franja disponible.
   * @param {FranjaHoraria} franja Franja consultada.
   * @returns {boolean} Verdadero si coinciden el día y las dos horas.
   */
  estaDisponible(franja) {
    return this.#disponibilidad.some((disponible) => disponible.esIgualA(franja))
  }

  /**
   * Calcula el promedio de las calificaciones de las sesiones de este tutor.
   * @param {import('./Sesion.js').default[]} sesiones Sesiones que se consultan.
   * @returns {number} Promedio redondeado a un decimal, o cero si no hay calificaciones.
   */
  calcularPromedio(sesiones) {
    const calificaciones = sesiones
      .filter((sesion) => sesion.getTutor().getId() === this.#id && sesion.getCalificacion() != null)
      .map((sesion) => sesion.getCalificacion())

    if (calificaciones.length === 0) {
      return 0
    }

    const suma = calificaciones.reduce((total, calificacion) => total + calificacion.getPuntaje(), 0)
    return Math.round((suma / calificaciones.length) * 10) / 10
  }

  /**
   * Comprueba si el perfil está verificado.
   * @returns {boolean} Verdadero si su estado es VERIFICADO.
   */
  estaVerificado() {
    return this.#estadoVerificacion === EstadoVerificacion.VERIFICADO
  }

  /**
   * Marca el perfil como verificado por la administración.
   * @returns {void}
   */
  marcarVerificado() {
    this.#estadoVerificacion = EstadoVerificacion.VERIFICADO
  }

  /**
   * Marca el perfil como rechazado por la administración.
   * @param {string} _motivo Motivo recibido; el modelo no define un atributo para persistirlo.
   * @returns {void}
   */
  marcarRechazado(_motivo) {
    this.#estadoVerificacion = EstadoVerificacion.RECHAZADO
  }

  /**
   * Serializa las referencias por identificador y las franjas como objetos embebidos.
   * @returns {object} Datos persistibles del perfil.
   */
  toJSON() {
    return {
      id: this.#id,
      estudianteId: this.#estudiante.getId(),
      biografia: this.#biografia,
      tarifaHora: this.#tarifaHora,
      estadoVerificacion: this.#estadoVerificacion,
      materiaIds: this.#materias.map((materia) => materia.getId()),
      disponibilidad: this.#disponibilidad.map((franja) => franja.toJSON()),
    }
  }

  /**
   * Reconstruye el perfil mediante la activación de su estudiante dueño.
   * @param {object} datos Datos persistidos del perfil.
   * @param {object} contexto Funciones para resolver las referencias guardadas.
   * @param {function(string): import('./Estudiante.js').default} contexto.buscarEstudiante Resuelve el dueño.
   * @param {function(string): import('./Materia.js').default} contexto.buscarMateria Resuelve las materias.
   * @returns {PerfilTutor} Perfil reconstruido y vinculado a su estudiante.
   * @throws {ErrorDeNegocio} Con R9 si las franjas se solapan o R10 si la tarifa no representa gratuidad o un importe positivo.
   * @throws {TypeError} Si el estado de verificación o las franjas persistidas no son válidos.
   * @throws {RangeError} Si alguna franja persistida no tiene duración positiva.
   */
  static desdeJSON(datos, contexto) {
    if (!Object.values(EstadoVerificacion).includes(datos.estadoVerificacion)) {
      throw new TypeError('El estado de verificación del perfil no es válido.')
    }

    const tarifaHora = datos.tarifaHora ?? null

    if (
      tarifaHora !== null &&
      (typeof tarifaHora !== 'number' || !Number.isFinite(tarifaHora) || tarifaHora <= 0)
    ) {
      throw new ErrorDeNegocio(
        'R10',
        'La tarifa de una tutoría gratuita debe ser nula; una tarifa de pago debe ser un número mayor que cero.',
      )
    }

    const estudiante = contexto.buscarEstudiante(datos.estudianteId)
    const perfil = estudiante.activarPerfilTutor(datos.biografia)
    perfil.#id = datos.id
    perfil.#biografia = datos.biografia
    perfil.#tarifaHora = tarifaHora
    perfil.#estadoVerificacion = datos.estadoVerificacion
    perfil.#materias = []
    perfil.#disponibilidad = []

    for (const materiaId of datos.materiaIds) {
      perfil.agregarMateria(contexto.buscarMateria(materiaId))
    }

    for (const franja of datos.disponibilidad) {
      perfil.agregarFranja(FranjaHoraria.desdeJSON(franja, contexto))
    }

    return perfil
  }
}
