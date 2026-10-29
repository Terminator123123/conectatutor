import { DiaSemana } from './enums.js'

/** Objeto de valor que representa un intervalo horario en un día de la semana. */
export default class FranjaHoraria {
  #dia
  #horaInicio
  #horaFin

  /**
   * Crea una franja con horas válidas en formato HH:MM.
   * @param {Object} datos Datos de la franja.
   * @param {string} datos.dia Valor de DiaSemana.
   * @param {string} datos.horaInicio Hora inicial en formato de 24 horas.
   * @param {string} datos.horaFin Hora final en formato de 24 horas.
   * @throws {TypeError} Si el día o el formato de las horas no son válidos.
   * @throws {RangeError} Si la hora inicial no es anterior a la final.
   */
  constructor({ dia, horaInicio, horaFin }) {
    if (!Object.values(DiaSemana).includes(dia)) {
      throw new TypeError('Selecciona un día válido para la franja horaria.')
    }

    const formatoHora = /^(?:[01]\d|2[0-3]):[0-5]\d$/

    if (
      typeof horaInicio !== 'string' ||
      typeof horaFin !== 'string' ||
      !formatoHora.test(horaInicio) ||
      !formatoHora.test(horaFin)
    ) {
      throw new TypeError('Las horas deben tener el formato HH:MM, entre 00:00 y 23:59.')
    }

    if (horaInicio >= horaFin) {
      throw new RangeError('La hora de inicio debe ser anterior a la hora de fin.')
    }

    this.#dia = dia
    this.#horaInicio = horaInicio
    this.#horaFin = horaFin
  }

  /**
   * Obtiene el día de la franja.
   * @returns {string} Valor de DiaSemana.
   */
  getDia() {
    return this.#dia
  }

  /**
   * Obtiene la hora inicial.
   * @returns {string} Hora en formato HH:MM.
   */
  getHoraInicio() {
    return this.#horaInicio
  }

  /**
   * Obtiene la hora final.
   * @returns {string} Hora en formato HH:MM.
   */
  getHoraFin() {
    return this.#horaFin
  }

  /**
   * Comprueba si dos franjas del mismo día comparten tiempo.
   * @param {FranjaHoraria} otra Franja que se compara.
   * @returns {boolean} Verdadero si los intervalos se cruzan; los extremos contiguos no se solapan.
   */
  seSolapaCon(otra) {
    return (
      otra instanceof FranjaHoraria &&
      this.#dia === otra.#dia &&
      this.#horaInicio < otra.#horaFin &&
      otra.#horaInicio < this.#horaFin
    )
  }

  /**
   * Compara el día y las dos horas de ambas franjas.
   * @param {FranjaHoraria} otra Franja que se compara.
   * @returns {boolean} Verdadero si todos sus valores coinciden.
   */
  esIgualA(otra) {
    return (
      otra instanceof FranjaHoraria &&
      this.#dia === otra.#dia &&
      this.#horaInicio === otra.#horaInicio &&
      this.#horaFin === otra.#horaFin
    )
  }

  /**
   * Describe el día y el intervalo horario.
   * @returns {string} Descripción de la franja.
   */
  toString() {
    return `${this.#dia} ${this.#horaInicio} - ${this.#horaFin}`
  }

  /**
   * Serializa el objeto de valor para guardarlo embebido.
   * @returns {{dia: string, horaInicio: string, horaFin: string}} Valores de la franja.
   */
  toJSON() {
    return {
      dia: this.#dia,
      horaInicio: this.#horaInicio,
      horaFin: this.#horaFin,
    }
  }

  /**
   * Reconstruye una franja y vuelve a validar sus valores.
   * @param {{dia: string, horaInicio: string, horaFin: string}} datos Franja serializada.
   * @param {object} [_contexto] Contexto de reconstrucción; no requiere resolver referencias.
   * @returns {FranjaHoraria} Instancia reconstruida.
   * @throws {TypeError} Si el día o el formato de las horas no son válidos.
   * @throws {RangeError} Si el intervalo no tiene duración positiva.
   */
  static desdeJSON(datos, _contexto) {
    return new FranjaHoraria(datos)
  }
}
